const CdbRequest = require('../models/cartodb_request');

module.exports = function user () {
    const cdbRequest = new CdbRequest();

    return function userMiddleware (req, res, next) {
        res.locals.user = cdbRequest.userByReq(req);
        next();
    };
};
