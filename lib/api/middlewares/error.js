'use strict';

const errorHandlerFactory = require('../../services/error-handler-factory');

module.exports = function error ({ logger }) {
    return function errorMiddleware (err, req, res, next) {
        const errorHandler = errorHandlerFactory(err);
        const errorResponse = errorHandler.getResponse();
        const errorLogger = res.locals.logger || logger;

        errorLogger.error({ exception: err }, 'Error while handling the request');

        // Force inline content disposition
        res.header('Content-Disposition', 'inline');

        res.header('Content-Type', 'application/json; charset=utf-8');
        res.status(getStatusError(errorHandler, req));

        if (req.query && req.query.callback) {
            res.jsonp(errorResponse);
        } else {
            res.json(errorResponse);
        }

        return next();
    };
};

function getStatusError (errorHandler, req) {
    let statusError = errorHandler.http_status;

    // JSONP has to return 200 status error
    if (req && req.query && req.query.callback) {
        statusError = 200;
    }

    return statusError;
}
