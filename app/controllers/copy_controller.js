'use strict';

const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const timeoutLimitsMiddleware = require('../middlewares/timeout-limits');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;
const Logger = require('../services/logger');
const errorHandlerFactory = require('../services/error_handler_factory');
const streamCopy = require('../services/stream_copy');

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
        const filename = req.query.filename || 'carto-sql-copyto.dmp';

        res.header("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
        res.header("Content-Type", "application/octet-stream");

        streamCopy.to(
            res, 
            req.query.q, 
            res.locals.userDbParams,
            res.locals.user,
            logger,
            function(err) {
                if (err) {
                    return next(err);
                }
                
                // this is a especial endpoint
                // the data from postgres is streamed to response directly
            }
        );
    };
}

function handleCopyFrom (logger) {
    return function handleCopyFromMiddleware (req, res, next) {
        streamCopy.from(
            req, 
            req.query.q, 
            res.locals.userDbParams, 
            res.locals.user,
            req.get('content-encoding') === 'gzip', 
            logger,
            function(err, metrics) { 
                if (err) {
                    return next(err);
                } 

                const { time, rows } = metrics;
                if (!rows) {
                    return next(new Error("No rows copied"));
                }

                res.send({
                    time,
                    total_rows: rows
                });
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

        // Only accept SQL that starts with 'COPY'
        if (!sql.toUpperCase().startsWith("COPY ")) {
            return next(new Error("SQL must start with COPY"));
        }

        next();
    };
}

function errorHandler () {
    return function errorHandlerMiddleware (err, req, res, next) {
        if (res.headersSent) {
            const errorHandler = errorHandlerFactory(err);
            res.write(JSON.stringify(errorHandler.getResponse()));
            res.end();
        } else {
            return next(err);
        }
    };
}

module.exports = CopyController;
