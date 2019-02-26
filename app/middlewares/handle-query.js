'use strict';

module.exports = function handleQuery () {
    return function handleQueryMiddleware (req, res, next) {
        res.locals.sql = (req.body && req.body.q) || (req.query && req.query.q);
        return next();
    };
};
