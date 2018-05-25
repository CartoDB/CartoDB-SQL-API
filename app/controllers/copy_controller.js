'use strict';

const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const timeoutLimitsMiddleware = require('../middlewares/timeout-limits');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;
const BunyanLogger = require('../services/bunyanLogger');
const errorHandlerFactory = require('../services/error_handler_factory');
const copyCommand = require('../services/copy_command');

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
            handleCopyFrom(this.logger),
            responseCopyFrom(),
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
        const filename = req.query.filename || 'carto-sql-copyto.dmp';

        res.header("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
        res.header("Content-Type", "application/octet-stream");

        copyCommand.streamCopyTo(
            res, 
            req.query.q, 
            res.locals.userDbParams, 
            function(err, metrics) {
            if (err) {
                if (res.headersSent) {
                    const errorHandler = errorHandlerFactory(err);
                    res.write(JSON.stringify(errorHandler.getResponse()));
                    res.end();
                } else {
                    return next(err);
                }
            } else {
                logger.info(metrics);
            }
        });
    };
}

function streamCopyFrom (logger) {
    return function handleCopyFromMiddleware (req, res, next) {
        copyCommand.pgCopyFrom(
            req, 
            req.query.q, 
            res.locals.userDbParams, 
            req.get('content-encoding') === 'gzip', 
            function(err, result, metrics) {
                if (err) {
                    if (res.headersSent) {
                        const errorHandler = errorHandlerFactory(err);
                        res.write(JSON.stringify(errorHandler.getResponse()));
                        res.end();
                    } else {
                        return next(err);
                    }
                } else {
                    logger.info(metrics);

                    // TODO: remove when data-ingestion log works
                    if (req.profiler) {
                        req.profiler.add({ copyFrom: metrics });	
                        res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());    
                    }

                    res.body = result;

                    next();
                }
            }
        )
    };
}

function responseCopyFrom () {
    return function responseCopyFromMiddleware (req, res, next) {
        if (!res.body || !res.body.total_rows) {
            return next(new Error("No rows copied"));
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
