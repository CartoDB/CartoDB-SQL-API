'use strict';

const os = require('os');

module.exports = function servedByHostHeader () {
    const hostname = global.settings.api_hostname || os.hostname().split('.')[0];

    return function servedByHostHeaderMiddleware (req, res, next) {
        res.set('X-Served-By-Host', hostname);

        next();
    };
};
