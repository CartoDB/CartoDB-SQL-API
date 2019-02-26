'use strict';

module.exports = function handleQuery () {
    return function handleQueryMiddleware (req, res, next) {
        res.locals.q = (req.body && req.body.q) || (req.query && req.query.q)
        return next();
    };
};
