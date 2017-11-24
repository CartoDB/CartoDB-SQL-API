var CdbRequest = require('../models/cartodb_request');
var cdbRequest = new CdbRequest();

module.exports = function userMiddleware(req, res, next) {
    res.locals.user = cdbRequest.userByReq(req);
    next();
};
