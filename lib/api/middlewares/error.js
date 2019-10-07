'use strict';

const errorHandlerFactory = require('../../services/error-handler-factory');
const { stringifyForLogs } = require('../../utils/logs');
const MAX_ERROR_STRING_LENGTH = 1024;

module.exports = function error() {
    return function errorMiddleware(err, req, res, next) {
        const errorHandler = errorHandlerFactory(err);
        let errorResponse = errorHandler.getResponse();

        if (global.settings.environment === 'development') {
            errorResponse.stack = err.stack;
        }

        if (global.settings.environment !== 'test') {
            // TODO: email this Exception report
            console.error("EXCEPTION REPORT: " + err.stack);
        }

        // Force inline content disposition
        res.header("Content-Disposition", 'inline');

        if (req && req.profiler) {
            req.profiler.done('finish');
            res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
        }

        setErrorHeader(errorHandler, res);

        res.header('Content-Type', 'application/json; charset=utf-8');
        res.status(getStatusError(errorHandler, req));
        if (req.query && req.query.callback) {
            res.jsonp(errorResponse);
        } else {
            res.json(errorResponse);
        }

        if (req && req.profiler) {
            res.req.profiler.sendStats();
        }

        next();
    };
};

function getStatusError(errorHandler, req) {
    let statusError = errorHandler.http_status;

    // JSONP has to return 200 status error
    if (req && req.query && req.query.callback) {
        statusError = 200;
    }

    return statusError;
}

function setErrorHeader(errorHandler, res) {
    const errorsLog = {
        context: errorHandler.context,
        detail: errorHandler.detail,
        hint: errorHandler.hint,
        statusCode: errorHandler.http_status,
        message: errorHandler.message
    };

    res.set('X-SQLAPI-Errors', stringifyForLogs(errorsLog, MAX_ERROR_STRING_LENGTH));
}
