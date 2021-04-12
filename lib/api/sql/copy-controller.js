'use strict';

const initLogger = require('../middlewares/logger');
const logReqRes = require('../middlewares/log-req-res');
const profiler = require('../middlewares/profiler');
const user = require('../middlewares/user');
const authorization = require('../middlewares/authorization');
const connectionParams = require('../middlewares/connection-params');
const dbQuota = require('../middlewares/db-quota');
const bodyParser = require('../middlewares/body-parser');
const rateLimits = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimits;
const errorHandlerFactory = require('../../services/error-handler-factory');
const StreamCopy = require('../../services/stream-copy');
const StreamCopyMetrics = require('../../services/stream-copy-metrics');
const Throttler = require('../../services/throttler-stream');
const zlib = require('zlib');
const { PassThrough } = require('stream');
const params = require('../middlewares/params');
const tag = require('../middlewares/tag');

module.exports = class CopyController {
    constructor ({ metadataBackend, userDatabaseService, statsdClient, userLimitsService, logger }) {
        this.metadataBackend = metadataBackend;
        this.userDatabaseService = userDatabaseService;
        this.statsdClient = statsdClient;
        this.userLimitsService = userLimitsService;
        this.logger = logger;
    }

    route (sqlRouter) {
        const copyFromMiddlewares = endpointGroup => {
            return [
                initLogger({ logger: this.logger }),
                user(this.metadataBackend),
                logReqRes(),
                profiler({ statsClient: this.statsdClient }),
                tag({ tags: ['ingestion', 'copyfrom'] }),
                rateLimits(this.userLimitsService, endpointGroup),
                authorization(this.metadataBackend),
                connectionParams(this.userDatabaseService),
                dbQuota(),
                params({ strategy: 'copyfrom' }),
                handleCopyFrom(),
                errorHandler()
            ];
        };

        const copyToMiddlewares = endpointGroup => {
            return [
                initLogger({ logger: this.logger }),
                user(this.metadataBackend),
                logReqRes({ logOnEvent: 'log' }),
                profiler({ statsClient: this.statsdClient, logOnEvent: 'log' }),
                tag({ tags: ['ingestion', 'copyto'], logOnEvent: 'log' }),
                bodyParser(),
                rateLimits(this.userLimitsService, endpointGroup),
                authorization(this.metadataBackend),
                connectionParams(this.userDatabaseService),
                params({ strategy: 'copyto' }),
                handleCopyTo({ logger: this.logger }),
                errorHandler()
            ];
        };

        sqlRouter.post('/copyfrom', copyFromMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_FROM));
        sqlRouter.get('/copyto', copyToMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_TO));
        sqlRouter.post('/copyto', copyToMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_TO));
    }
};

function handleCopyTo ({ logger: mainLogger }) {
    return function handleCopyToMiddleware (req, res, next) {
        const { logger } = res.locals;
        const { request_id: requestId } = logger.bindings();
        const { userDbParams, user } = res.locals;
        const { sql, filename } = res.locals.params;

        // it is not sure, nginx may choose not to compress the body
        // but we want to know it and save it in the metrics
        // https://github.com/CartoDB/CartoDB-SQL-API/issues/515
        const isGzip = req.get('accept-encoding') && req.get('accept-encoding').includes('gzip');

        const streamCopy = new StreamCopy(sql, userDbParams, logger);
        const metrics = new StreamCopyMetrics(logger, 'copyto', sql, user, isGzip);

        res.header('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
        res.header('Content-Type', 'application/octet-stream');

        streamCopy.getPGStream(StreamCopy.ACTION_TO, (err, pgstream) => {
            if (err) {
                return next(err);
            }

            req.on('aborted', () => {
                const err = new Error('Connection closed by client');

                metrics.end(null, err);
                res.emit('log');
                pgstream.emit('error', err);

                const pid = streamCopy.clientProcessID;
                streamCopy.cancel(pid, StreamCopy.ACTION_TO, (err) => {
                    if (err) {
                        return mainLogger.error({ 'cdb-user': user, request_id: requestId, exception: err, action: `copy-${StreamCopy.ACTION_TO}`, pid }, 'Unable to cancel stream query');
                    }

                    mainLogger.info({ 'cdb-user': user, request_id: requestId, action: `copy-${StreamCopy.ACTION_TO}`, pid }, 'Canceled stream query successfully');
                });

                return next(err);
            });

            pgstream
                .on('data', data => metrics.addSize(data.length))
                .on('error', err => {
                    metrics.end(null, err);
                    return next(err);
                })
                .on('end', () => {
                    metrics.end(streamCopy.getRowCount());
                    res.emit('log');
                    return next();
                })
                .pipe(res);
        });
    };
}

function handleCopyFrom () {
    return function handleCopyFromMiddleware (req, res, next) {
        const { logger } = res.locals;
        const { userDbParams, user, dbRemainingQuota } = res.locals;
        const { sql } = res.locals.params;
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
                .on('close', () => pgstream.emit('client-close', new Error('Connection closed by client')))
                .pipe(throttle)
                .pipe(decompress)
                .on('data', data => {
                    metrics.addSize(data.length);

                    if (metrics.size > dbRemainingQuota) {
                        return pgstream.emit('error', new Error('DB Quota exceeded'));
                    }

                    if ((metrics.gzipSize || metrics.size) > COPY_FROM_MAX_POST_SIZE) {
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
                        return next(new Error('No rows copied'));
                    }

                    res.send({
                        time,
                        total_rows: rows
                    });

                    return next();
                });
        });
    };
}

function errorHandler () {
    return function errorHandlerMiddleware (err, req, res, next) {
        const { logger } = res.locals;
        if (res.headersSent) {
            logger.error({ exception: err }, 'Error while handling the request');
            const errorHandler = errorHandlerFactory(err);
            res.write(JSON.stringify(errorHandler.getResponse()));
            res.end();
            next();
        } else {
            return next(err);
        }
    };
}
