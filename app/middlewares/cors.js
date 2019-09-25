'use strict';

module.exports = function cors(extraHeaders = []) {
    return function (req, res, next) {
        const headers = [
            'X-Requested-With',
            'X-Prototype-Version',
            'X-CSRF-Token',
            'Authorization',
            'Carto-Rate-Limit-Limit',
            'Carto-Rate-Limit-Remaining',
            'Carto-Rate-Limit-Reset',
            'Retry-After',
            ...extraHeaders
        ];

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', headers.join(', '));

        next();
    };
};
