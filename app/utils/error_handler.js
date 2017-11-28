'use strict';

var _ = require('underscore');
var PgErrorHandler = require('../postgresql/error_handler');

// jshint unused: false
module.exports = function handleException(err, res) {
    var pgErrorHandler = new PgErrorHandler(err);

    var msg = {
        error: [pgErrorHandler.getMessage()]
    };

    _.defaults(msg, pgErrorHandler.getFields());

    if (global.settings.environment === 'development') {
        msg.stack = err.stack;
    }

    if (global.settings.environment !== 'test'){
        // TODO: email this Exception report
        console.error("EXCEPTION REPORT: " + err.stack);
    }

    // Force inline content disposition
    res.header("Content-Disposition", 'inline');

    var req = res.req;

    if (req && req.profiler ) {
      req.profiler.done('finish');
      res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
    }

    logErrors(msg, pgErrorHandler.getStatus(), res);
    
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
};

function getStatusError(pgErrorHandler, req) {

    var statusError = pgErrorHandler.getStatus();

    // JSONP has to return 200 status error
    if (req && req.query && req.query.callback) {
        statusError = 200;
    }

    return statusError;
}

function logErrors(err, statusCode, res) {
    let errorsLog = Object.assign({}, err);

    errorsLog.statusCode = statusCode || 200;
    errorsLog.message = err.error;
    delete err.error;

    res.set('X-SQLAPI-Errors', JSON.stringify(errorsLog));
}
