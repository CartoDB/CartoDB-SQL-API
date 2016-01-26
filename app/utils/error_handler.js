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

    if ( res.req && res.req.profiler ) {
      res.req.profiler.done('finish');
      res.header('X-SQLAPI-Profiler', res.req.profiler.toJSONString());
    }

    res.send(msg, getStatusError(pgErrorHandler, res.req));

    if ( res.req && res.req.profiler ) {
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
