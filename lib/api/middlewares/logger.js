'use strict';

const uuid = require('uuid');

module.exports = function initLogger ({ logger, logOnEvent = 'finish' }) {
    return function initLoggerMiddleware (req, res, next) {
        const requestId = req.get('X-Request-Id') || uuid.v4();
        res.locals.logger = logger.child({ request_id: requestId });
        res.locals.logger.info({ client_request: req }, 'Incoming request');
        res.on(logOnEvent, () => res.locals.logger.info({ server_response: res, status: res.statusCode }, 'Response sent'));
        next();
    };
};
