'use strict';

module.exports = function handleQuery(isBatchAPIQuery = false) {
    return function handleQueryMiddleware(req, res, next) {
        res.locals.sql = isBatchAPIQuery ? batchApiQuery(req) : notBatchApiQuery(req);

        return next();
    };
};

function notBatchApiQuery(req) {
    return (req.body && req.body.q) || (req.query && req.query.q);
}

function batchApiQuery(req) {
    return req.body && req.body.query;
}
