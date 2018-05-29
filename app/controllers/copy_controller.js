'use strict';

const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const timeoutLimitsMiddleware = require('../middlewares/timeout-limits');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;
const { getFormatFromCopyQuery } = require('../utils/query_info');
const BunyanLogger = require('../services/bunyanLogger');
const errorHandlerFactory = require('../services/error_handler_factory');

const zlib = require('zlib');
const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;


function CopyController(metadataBackend, userDatabaseService, userLimitsService, statsClient) {
    this.metadataBackend = metadataBackend;
    this.userDatabaseService = userDatabaseService;
    this.userLimitsService = userLimitsService;
    this.statsClient = statsClient;

    this.logger = new BunyanLogger(global.settings.dataIngestionLogPath, 'data-ingestion');
}

CopyController.prototype.route = function (app) {
    const { base_url } = global.settings;

    const copyFromMiddlewares = endpointGroup => {
        return [
            initializeProfilerMiddleware('copyfrom'),
            userMiddleware(),
            rateLimitsMiddleware(this.userLimitsService, endpointGroup),
            authorizationMiddleware(this.metadataBackend),
            connectionParamsMiddleware(this.userDatabaseService),
            timeoutLimitsMiddleware(this.metadataBackend),
            validateCopyQuery(),
            handleCopyFrom(),
            responseCopyFrom(this.logger),
            errorMiddleware()
        ];
    };

    const copyToMiddlewares = endpointGroup => {
        return [
            initializeProfilerMiddleware('copyto'),
            userMiddleware(),
            rateLimitsMiddleware(this.userLimitsService, endpointGroup),
            authorizationMiddleware(this.metadataBackend),
            connectionParamsMiddleware(this.userDatabaseService),
            timeoutLimitsMiddleware(this.metadataBackend),
            validateCopyQuery(),
            handleCopyTo(this.logger),
            errorMiddleware()
        ];
    };

    app.post(`${base_url}/sql/copyfrom`, copyFromMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_FROM));
    app.get(`${base_url}/sql/copyto`, copyToMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_TO));
};


function handleCopyTo (logger) {
    return function handleCopyToMiddleware (req, res, next) {
        const sql = req.query.q;
        const filename = req.query.filename || 'carto-sql-copyto.dmp';

        let metrics = {
            type: 'copyto',
            size: 0,
            time: null,
            format: getFormatFromCopyQuery(sql),
            total_rows: null
        };

        res.header("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
        res.header("Content-Type", "application/octet-stream");

        const startTime = Date.now();

        const pg = new PSQL(res.locals.userDbParams);
        pg.connect(function (err, client) {
            if (err) {
                return next(err);
            }

            const copyToStream = copyTo(sql);
            const pgstream = client.query(copyToStream);
            pgstream
                .on('error', err => {
                    pgstream.unpipe(res);
                    const errorHandler = errorHandlerFactory(err);
                    res.write(JSON.stringify(errorHandler.getResponse()));
                    res.end();
                })
                .on('data', data => metrics.size += data.length)
                .on('end', () => {
                    metrics.time = (Date.now() - startTime) / 1000;
                    metrics.total_rows = copyToStream.rowCount;
                    logger.info(metrics);
                })
                .pipe(res);
        });
    };
}

function handleCopyFrom () {
    return function handleCopyFromMiddleware (req, res, next) {
        const sql = req.query.q;
        res.locals.copyFromSize = 0;

        const startTime = Date.now();

        const pg = new PSQL(res.locals.userDbParams);
        pg.connect(function (err, client) {
            if (err) {
                return next(err);
            }

            let copyFromStream = copyFrom(sql);
            const pgstream = client.query(copyFromStream);
            pgstream
                .on('error', err => {
                    console.error("in .on('error')");
                    return next(err);
                })
                .on('end', function () {
                    res.body = {
                        time: (Date.now() - startTime) / 1000,
                        total_rows: copyFromStream.rowCount
                    };

                    return next();
                });

            let requestEnded = false;

            if (req.get('content-encoding') === 'gzip') {
                req = req.pipe(zlib.createGunzip());
            }

            req
                .on('error', err => {
                    req.unpipe(pgstream);
                    pgstream.end();
                    return next(err);
                })
                .on('close', () => {
                    if (!requestEnded) {
                        console.error("client closed connection! timber!");

                        const { Client } = require('pg')

                        const runningClient = client;
                        const cancelingClient = new Client(runningClient.connectionParameters);
                        const connection = cancelingClient.connection;
                        connection.connect(runningClient.port, runningClient.host)
                        connection.on('connect', () => {
                            connection.cancel(runningClient.processID, runningClient.secretKey);
                        });

                        return next(new Error('Connection closed by client'));
                    }
                })
                .on('data', data => res.locals.copyFromSize += data.length)
                .on('end', () => requestEnded = true)
                .pipe(pgstream);
        });
    };
}

function responseCopyFrom (logger) {
    return function responseCopyFromMiddleware (req, res, next) {
        if (!res.body || !res.body.total_rows) {
            return next(new Error("No rows copied"));
        }

        const metrics = {
            type: 'copyfrom',
            size: res.locals.copyFromSize, //bytes
            format: getFormatFromCopyQuery(req.query.q),
            time: res.body.time, //seconds
            total_rows: res.body.total_rows,
            gzip: req.get('content-encoding') === 'gzip'
        };

        logger.info(metrics);

        // TODO: remove when data-ingestion log works
        if (req.profiler) {
            req.profiler.add({ copyFrom: metrics });
            res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
        }

        res.send(res.body);
    };
}

function validateCopyQuery () {
    return function validateCopyQueryMiddleware (req, res, next) {
        const sql = req.query.q;

        if (!sql) {
            next(new Error("SQL is missing"));
        }

        // Only accept SQL that starts with 'COPY'
        if (!sql.toUpperCase().startsWith("COPY ")) {
            next(new Error("SQL must start with COPY"));
        }

        next();
    };
}


module.exports = CopyController;
