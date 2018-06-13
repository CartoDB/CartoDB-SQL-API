'use strict';

const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const timeoutLimitsMiddleware = require('../middlewares/timeout-limits');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;
const errorHandlerFactory = require('../services/error_handler_factory');
const StreamCopy = require('../services/stream_copy');
const StreamCopyMetrics = require('../services/stream_copy_metrics');
const Logger = require('../services/logger');
const { Client } = require('pg');
const zlib = require('zlib');

function CopyController(metadataBackend, userDatabaseService, userLimitsService, statsClient) {
    this.metadataBackend = metadataBackend;
    this.userDatabaseService = userDatabaseService;
    this.userLimitsService = userLimitsService;
    this.statsClient = statsClient;

    this.logger = new Logger(global.settings.dataIngestionLogPath, 'data-ingestion');
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
            timeoutLimitsMiddleware(this.metadataBackend),
            validateCopyQuery(),
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
            timeoutLimitsMiddleware(this.metadataBackend),
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

        streamCopy.to(
            function (err, pgstream, copyToStream, client, done) {
                if (err) {
                    return next(err);
                }

                let responseEnded = false;

                res
                    .on('error', err => {
                        metrics.end(null, err);
                        pgstream.unpipe(res);
                        done();
                        return next(err);
                    })
                    .on('close', () => {
                        if (!responseEnded) {
                            streamCopy.setConnectionClosedByClient(true);

                            // Cancel the running COPY TO query
                            // See https://www.postgresql.org/docs/9.5/static/protocol-flow.html#PROTOCOL-COPY
                            const runningClient = client;
                            const cancelingClient = new Client(runningClient.connectionParameters);
                            cancelingClient.cancel(runningClient, pgstream);

                            const err = new Error('Connection closed by client');
                            metrics.end(null, err);
                            pgstream.unpipe(res);
                            // see https://node-postgres.com/api/pool#releasecallback
                            done(err);
                            return next(err);
                        }
                    })
                    .on('end', () => responseEnded = true);

                pgstream.on('error', (err) => {
                    metrics.end(null, err);
                    pgstream.unpipe(res);

                    return next(err);
                });

                pgstream.on('end', () => metrics.end(copyToStream.rowCount));

                pgstream
                    .on('data', data => metrics.addSize(data.length))
                    .pipe(res);
            }
        );
    };
}

function handleCopyFrom (logger) {
    return function handleCopyFromMiddleware (req, res, next) {
        const sql = req.query.q;
        const { userDbParams, user } = res.locals;
        const isGzip = req.get('content-encoding') === 'gzip';

        const streamCopy = new StreamCopy(sql, userDbParams);
        const metrics = new StreamCopyMetrics(logger, 'copyfrom', sql, user, isGzip);

        streamCopy.on('copy-from-end', rows => {
            metrics.end(rows);

            const { time } = metrics;
            if (!time || !rows) {
                return next(new Error("No rows copied"));
            }

            res.send({
                time,
                total_rows: rows
            });
        });

        streamCopy.from(
            function (err, pgstream, client, done) {
                if (err) {
                    return next(err);
                }

                let requestEnded = false;
                req
                    .on('error', err => {
                        metrics.end(null, err);
                        req.unpipe(pgstream);
                        pgstream.end();
                        done();

                        next(err);
                    })
                    .on('close', () => {
                        if (!requestEnded) {
                            const err = new Error('Connection closed by client');
                            metrics.end(null, err);
                            const connection = client.connection;
                            connection.sendCopyFail('CARTO SQL API: Connection closed by client');
                            req.unpipe(pgstream);
                            done();
                            next(err);
                        }
                    })
                    .on('data', data => {
                        if (isGzip) {
                            metrics.addGzipSize(data.length);
                        } else {
                            metrics.addSize(data.length);
                        }
                    })
                    .on('end', () => requestEnded = true);

                pgstream.on('error', (err) => {
                    metrics.end(null, err);
                    req.unpipe(pgstream);

                    return next(err);
                });

                if (isGzip) {
                    req
                        .pipe(zlib.createGunzip())
                        .on('data', data => metrics.addSize(data.length))
                        .pipe(pgstream);
                } else {
                    req.pipe(pgstream);
                }
            }
        );
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
