'use strict';

module.exports = function logReqRes ({ logOnEvent = 'finish' } = {}) {
    return function logReqResMiddleware (req, res, next) {
        const { logger } = res.locals;
        logger.info({ client_request: req }, 'Incoming request');
        res.on(logOnEvent, () => logger.info({ server_response: res, status: res.statusCode }, 'Response sent'));
        res.on('close', () => res.locals.logger.info({ end: true }, 'Request done'));
        next();
    };
};
