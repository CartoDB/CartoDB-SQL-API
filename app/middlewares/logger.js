'use strict';

module.exports = function logger () {
    if (!global.log4js) {
        return function dummyLoggerMiddleware (req, res, next) {
            next();
        };
    }

    const options = {
        level: 'info',
        buffer: true,
        // log4js provides a tokens solution as expess but in does not provide the request/response in the callback.
        // Thus it is not possible to extract relevant information from them.
        // This is a workaround to be able to access request/response.
        format: function (req, res, format) {
            const defaultFormat = ':remote-addr :method :req[Host]:url :status :response-time ms -> :res[Content-Type]';
            const logFormat = global.settings.log_format || defaultFormat;

            return format(logFormat);
        }
    };

    const logger = global.log4js.getLogger();

    return global.log4js.connectLogger(logger, options);
};
