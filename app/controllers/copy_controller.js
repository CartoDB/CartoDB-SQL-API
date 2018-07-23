'use strict';

const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const dbQuotaMiddleware = require('../middlewares/db-quota');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;
const errorHandlerFactory = require('../services/error_handler_factory');
const StreamCopy = require('../services/stream_copy');
const StreamCopyMetrics = require('../services/stream_copy_metrics');
const zlib = require('zlib');
const { PassThrough } = require('stream');

function CopyController(metadataBackend, userDatabaseService, userLimitsService, logger) {
    this.metadataBackend = metadataBackend;
    this.userDatabaseService = userDatabaseService;
    this.userLimitsService = userLimitsService;
    this.logger = logger;
}

CopyController.prototype.route = function (app) {
    const { base_url } = global.settings;

    const copyFromMiddlewares = endpointGroup => {
        return [
            initializeProfilerMiddleware('copyfrom'),
            userMiddleware(this.metadataBackend),
            rateLimitsMiddleware(this.userLimitsService, endpointGroup),
            authorizationMiddleware(this.metadataBackend),
            connectionParamsMiddleware(this.userDatabaseService),
            validateCopyQuery(),
            dbQuotaMiddleware(),
            handleCopyFrom(this.logger),
            errorHandler(),
            errorMiddleware()
        ];
    };

    const copyToMiddlewares = endpointGroup => {
        return [
            initializeProfilerMiddleware('copyto'),
            userMiddleware(this.metadataBackend),
            rateLimitsMiddleware(this.userLimitsService, endpointGroup),
            authorizationMiddleware(this.metadataBackend),
            connectionParamsMiddleware(this.userDatabaseService),
            validateCopyQuery(),
            handleCopyTo(this.logger),
            errorHandler(),
            errorMiddleware()
        ];
    };

    app.post(`${base_url}/sql/copyfrom`, copyFromMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_FROM));
    app.get(`${base_url}/sql/copyto`, copyToMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_TO));
};


function handleCopyTo (logger) {
    return function handleCopyToMiddleware (req, res, next) {
        const sql = req.query.q;
        const { userDbParams, user } = res.locals;
        const filename = req.query.filename || 'carto-sql-copyto.dmp';

        const streamCopy = new StreamCopy(sql, userDbParams);
        const metrics = new StreamCopyMetrics(logger, 'copyto', sql, user);

        res.header("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
        res.header("Content-Type", "application/octet-stream");

        streamCopy.getPGStream(StreamCopy.ACTION_TO, (err, pgstream) => {
            if (err) {
                return next(err);
            }

            pgstream
                .on('data', data => metrics.addSize(data.length))
                .on('error', err => {
                    metrics.end(null, err);
                    pgstream.unpipe(res);

                    return next(err);
                })
                .on('end', () => metrics.end( streamCopy.getRowCount(StreamCopy.ACTION_TO) ))
                .pipe(res)
                .on('close', () => {
                    const err = new Error('Connection closed by client');
                    pgstream.emit('cancelQuery', err);
                    pgstream.emit('error', err);
                })
                .on('error', err => {
                    pgstream.emit('error', err);
                });
        });
    };
}

function handleCopyFrom (logger) {
    return function handleCopyFromMiddleware (req, res, next) {
        const sql = req.query.q;
        const { userDbParams, user, dbRemainingQuota } = res.locals;
        const isGzip = req.get('content-encoding') === 'gzip';
        const copy_from_max_post_size = global.settings.copy_from_max_post_size || 1.99 * 1024 * 1024 * 1024; // 1.99 GB
        const copy_from_max_post_size_pretty = global.settings.copy_from_max_post_size_pretty || '2 GB';

        const streamCopy = new StreamCopy(sql, userDbParams);
        const metrics = new StreamCopyMetrics(logger, 'copyfrom', sql, user, isGzip);

        streamCopy.getPGStream(StreamCopy.ACTION_FROM, (err, pgstream) => {
            if (err) {
                return next(err);
            }

            req
                .on('data', data => isGzip ? metrics.addGzipSize(data.length) : undefined)
                .on('error', err => {
                    metrics.end(null, err);
                    pgstream.emit('error', err);
                })
                .on('close', () => {
                    const err = new Error('Connection closed by client');
                    pgstream.emit('cancelQuery', err);
                    pgstream.emit('error', err);
                })
                .pipe(isGzip ? zlib.createGunzip() : new PassThrough())
                .on('data', data => {
                    metrics.addSize(data.length);

                    if(metrics.size > dbRemainingQuota) {
                        const quotaError = new Error('DB Quota exceeded');
                        metrics.end(null, quotaError);
                        req.unpipe(pgstream);
                        return next(quotaError);
                    }
                    if((metrics.gzipSize || metrics.size) > copy_from_max_post_size) {
                        const maxPostSizeError = new Error(
                            `COPY FROM maximum POST size of ${copy_from_max_post_size_pretty} exceeded`
                        );
                        metrics.end(null, maxPostSizeError);
                        req.unpipe(pgstream);
                        return next(maxPostSizeError);
                    }
                })
                .pipe(pgstream)
                .on('error', err => {
                    metrics.end(null, err);
                    req.unpipe(pgstream);
                    return next(err);
                })
                .on('end', () => {
                    metrics.end( streamCopy.getRowCount(StreamCopy.ACTION_FROM) );

                    const { time, rows } = metrics;

                    if (!rows) {
                        return next(new Error("No rows copied"));
                    }

                    res.send({
                        time,
                        total_rows: rows
                    });
                });
        });
    };
}

function validateCopyQuery () {
    return function validateCopyQueryMiddleware (req, res, next) {
        const sql = req.query.q;

        if (!sql) {
            return next(new Error("SQL is missing"));
        }

        if (!sql.toUpperCase().startsWith("COPY ")) {
            return next(new Error("SQL must start with COPY"));
        }

        next();
    };
}

function errorHandler () {
    return function errorHandlerMiddleware (err, req, res, next) {
        if (res.headersSent) {
            console.error("EXCEPTION REPORT: " + err.stack);
            const errorHandler = errorHandlerFactory(err);
            res.write(JSON.stringify(errorHandler.getResponse()));
            res.end();
        } else {
            return next(err);
        }
    };
}

module.exports = CopyController;
