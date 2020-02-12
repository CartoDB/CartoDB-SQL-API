'use strict';

module.exports = function cors (extraHeaders = []) {
    return function (req, res, next) {
        const headers = [
            'X-Requested-With',
            'X-Prototype-Version',
            'X-CSRF-Token',
            'Authorization',
            'Carto-Source-Lib',
            'Carto-Source-Context',
            'Carto-Source-Context-Id',
            ...extraHeaders
        ];

        const exposedHeaders = [
            'Carto-Rate-Limit-Limit',
            'Carto-Rate-Limit-Remaining',
            'Carto-Rate-Limit-Reset',
            'Retry-After'
        ];

        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', headers.join(', '));
        res.header('Access-Control-Expose-Headers', exposedHeaders.join(', '));

        if (req.method === 'OPTIONS') {
            return res.send();
        }

        next();
    };
};
