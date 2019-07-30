'use strict';

const queryMayWrite = require('../utils/query_may_write');

module.exports = function mayWrite () {
    return function mayWriteMiddleware (req, res, next) {
        const { sql } = res.locals.params;
        res.locals.mayWrite = queryMayWrite(sql);

        next();
    };
};
