var ErrorHandler = require('../services/error_handler');
var pgErrorCodes = require('../postgresql/error_codes');

module.exports = function errorMiddleware() {
    return function error(err, req, res, next) {
        let errorHandler = getErrorHandler(err);

        var msg = errorHandler.getResponse();

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

        setErrorHeader(msg, errorHandler.http_status, res);

        res.header('Content-Type', 'application/json; charset=utf-8');
        res.status(getStatusError(errorHandler, req));
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

function getStatusError(errorHandler, req) {

    var statusError = errorHandler.http_status;

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

function getErrorHandler (err) {
    if (isTimeoutError(err)) {
        return createTimeoutError();
    } else {
        return createGenericError(err);
    }
}

function isTimeoutError(err) {
    return err.message && (
        err.message.indexOf('statement timeout') > -1 ||
        err.message.indexOf('RuntimeError: Execution of function interrupted by signal') > -1
    );
}

function createTimeoutError() {
    return new ErrorHandler(
        'You are over platform\'s limits. Please contact us to know more details',
        'limit',
        'datasource',
        undefined,
        429
    );
}

function createGenericError(err) {
    return new ErrorHandler(
        err.message,
        err.context, 
        err.detail, 
        err.hint, 
        err.http_status, 
        pgErrorCodes.codeToCondition[err.code] || err.name
    );
}
