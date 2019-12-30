'use strict';

module.exports = function socketTimeout () {
    if (!Object.prototype.hasOwnProperty.call(global.settings, 'node_socket_timeout')) {
        return function dummySocketTimeoutMiddleware (req, res, next) {
            next();
        };
    }

    const timeout = parseInt(global.settings.node_socket_timeout);

    return function socketTimeoutMiddleware (req, res, next) {
        // Set connection timeout
        req.connection.setTimeout(timeout);

        next();
    };
};
