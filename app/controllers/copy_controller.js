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
const { PassThrough, Transform } = require('stream');
const handleQueryMiddleware = require('../middlewares/handle-query');

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
            handleQueryMiddleware(),
            handleCopyFrom(this.logger),
            errorHandler(this.logger),
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
            handleQueryMiddleware(),
            handleCopyTo(this.logger),
            errorHandler(this.logger),
            errorMiddleware()
        ];
    };

    app.post(`${base_url}/sql/copyfrom`, copyFromMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_FROM));
    app.get(`${base_url}/sql/copyto`, copyToMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_TO));
};


function handleCopyTo (logger) {
    return function handleCopyToMiddleware (req, res, next) {
        const { sql, userDbParams, user } = res.locals;
        const filename = req.query.filename || 'carto-sql-copyto.dmp';

        // it is not sure, nginx may choose not to compress the body
        // but we want to know it and save it in the metrics
        // https://github.com/CartoDB/CartoDB-SQL-API/issues/515
        const isGzip = req.get('accept-encoding') && req.get('accept-encoding').includes('gzip');

        const streamCopy = new StreamCopy(sql, userDbParams, logger);
        const metrics = new StreamCopyMetrics(logger, 'copyto', sql, user, isGzip);

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

                    return next(err);
                })
                .on('end', () => metrics.end(streamCopy.getRowCount()))
            .pipe(res)
                .on('close', () => pgstream.emit('error', new Error('Connection closed by client')))
                .on('error', err => pgstream.emit('error', err));
        });
    };
}

class Throttler extends Transform {
    constructor (pgstream, ...args) {
        super(...args);

        this.pgstream = pgstream;

        this.sampleLength = global.settings.copy_from_maximum_slow_input_speed_interval || 15;
        this.minimunBytesPerSecondThershold = global.settings.copy_from_minimum_input_speed || 1;
        this.byteCount = 0;
        this.bytesPerSecondHistory = [];

        this._interval = setInterval(this._updateMetrics.bind(this), 1000);
    }

    _updateMetrics () {
        this.bytesPerSecondHistory.push(this.byteCount);
        this.byteCount = 0;

        if (this.bytesPerSecondHistory > this.sampleLength) {
            this.bytesPerSecondHistory.shift();
        }

        const doesNotReachThreshold = [];

        for (const bytesPerSecond of this.bytesPerSecondHistory) {
            if (bytesPerSecond <= this.minimunBytesPerSecondThershold) {
                doesNotReachThreshold.push(true);
            }
        }

        if (doesNotReachThreshold.length >= this.sampleLength) {
            clearInterval(this._interval);
            this.pgstream.emit('error', new Error('Connection closed by server: input data too slow'));
        }
    }

    _transform (chunk, encoding, callback) {
        this.byteCount += chunk.length;
        callback(null, chunk);
    }

    _flush (callback) {
        clearInterval(this._interval);
        callback();
    }
}

function handleCopyFrom (logger) {
    return function handleCopyFromMiddleware (req, res, next) {
        const { sql, userDbParams, user, dbRemainingQuota } = res.locals;
        const isGzip = req.get('content-encoding') === 'gzip';
        const COPY_FROM_MAX_POST_SIZE = global.settings.copy_from_max_post_size || 2 * 1024 * 1024 * 1024; // 2 GB
        const COPY_FROM_MAX_POST_SIZE_PRETTY = global.settings.copy_from_max_post_size_pretty || '2 GB';

        const streamCopy = new StreamCopy(sql, userDbParams, logger);
        const decompress = isGzip ? zlib.createGunzip() : new PassThrough();
        const metrics = new StreamCopyMetrics(logger, 'copyfrom', sql, user, isGzip);

        streamCopy.getPGStream(StreamCopy.ACTION_FROM, (err, pgstream) => {
            if (err) {
                return next(err);
            }

            const throttle = new Throttler(pgstream);

            req
                .on('data', data => isGzip ? metrics.addGzipSize(data.length) : undefined)
                .on('error', err => {
                    metrics.end(null, err);
                    pgstream.emit('error', err);
                })
                .on('close', () => pgstream.emit('error', new Error('Connection closed by client')))
            .pipe(throttle)
            .pipe(decompress)
                .on('data', data => {
                    metrics.addSize(data.length);

                    if(metrics.size > dbRemainingQuota) {
                        return pgstream.emit('error', new Error('DB Quota exceeded'));
                    }

                    if((metrics.gzipSize || metrics.size) > COPY_FROM_MAX_POST_SIZE) {
                        return pgstream.emit('error', new Error(
                            `COPY FROM maximum POST size of ${COPY_FROM_MAX_POST_SIZE_PRETTY} exceeded`
                        ));
                    }
                })
                .on('error', err => {
                    err.message = `Error while gunzipping: ${err.message}`;
                    metrics.end(null, err);
                    pgstream.emit('error', err);
                })
            .pipe(pgstream)
                .on('error', err => {
                    metrics.end(null, err);

                    return next(err);
                })
                .on('end', () => {
                    metrics.end(streamCopy.getRowCount());

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

function errorHandler (logger) {
    return function errorHandlerMiddleware (err, req, res, next) {
        if (res.headersSent) {
            logger.error(err);
            const errorHandler = errorHandlerFactory(err);
            res.write(JSON.stringify(errorHandler.getResponse()));
            res.end();
        } else {
            return next(err);
        }
    };
}

module.exports = CopyController;
