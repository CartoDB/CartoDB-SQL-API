var _ = require('underscore');
var PgErrorHandler = require('../postgresql/error_handler');

module.exports = function errorMiddleware() {
    return function error(err, req, res, next) {
        if (isTimeoutError(err)) {
            pgErrorHandler = createTimeoutError();
        } else {
            pgErrorHandler = createPgError(err);
        }

        var msg = pgErrorHandler.getResponse();

        if (global.settings.environment === 'development') {
            msg.stack = err.stack;
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

        setErrorHeader(msg, pgErrorHandler.http_status, res);

        res.header('Content-Type', 'application/json; charset=utf-8');
        res.status(getStatusError(pgErrorHandler, req));
        if (req.query && req.query.callback) {
            res.jsonp(msg);
        } else {
            res.json(msg);
        }

        if (req && req.profiler) {
            res.req.profiler.sendStats();
        }

        next();
    };
};

function getStatusError(pgErrorHandler, req) {

    var statusError = pgErrorHandler.http_status;

    // JSONP has to return 200 status error
    if (req && req.query && req.query.callback) {
        statusError = 200;
    }

    return statusError;
}

function setErrorHeader(err, statusCode, res) {
    let errorsLog = Object.assign({}, err);

    errorsLog.statusCode = statusCode || 200;
    errorsLog.message = errorsLog.error[0];
    delete errorsLog.error;

    res.set('X-SQLAPI-Errors', stringifyForLogs(errorsLog));
}

/**
 * Remove problematic nested characters
 * from object for logs RegEx
 *
 * @param {Object} object
 */
function stringifyForLogs(object) {
    Object.keys(object).map(key => {
        if (typeof object[key] === 'string') {
            object[key] = object[key].replace(/[^a-zA-Z0-9]/g, ' ');
        } else if (typeof object[key] === 'object') {
            stringifyForLogs(object[key]);
        } else if (object[key] instanceof Array) {
            for (let element of object[key]) {
                stringifyForLogs(element);
            }
        }
    });

    return JSON.stringify(object);
}

function isTimeoutError(err) {
    return err.message && (
        err.message.indexOf('statement timeout') > -1 ||
        err.message.indexOf('RuntimeError: Execution of function interrupted by signal') > -1
    );
}

function createTimeoutError() {
    return new PgErrorHandler(
        'You are over platform\'s limits. Please contact us to know more details',
        429,
        'limit',
        'datasource'
    );
}

function createPgError(err) {
    return new PgErrorHandler(
        err.message,
        PgErrorHandler.getStatus(err), 
        err.context, 
        err.detail, 
        err.hint, 
        PgErrorHandler.getName(err)
    );
}
