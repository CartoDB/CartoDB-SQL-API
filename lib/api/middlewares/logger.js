'use strict';

const uuid = require('uuid');

module.exports = function initLogger ({ logger }) {
    return function initLoggerMiddleware (req, res, next) {
        const requestId = req.get('X-Request-Id') || uuid.v4();
        res.locals.logger = logger.child({ request_id: requestId });
        next();
    };
};
