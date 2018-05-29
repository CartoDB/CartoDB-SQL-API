const CdbRequest = require('../models/cartodb_request');

module.exports = function user(metadataBackend) {
    const cdbRequest = new CdbRequest();

    return function userMiddleware (req, res, next) {
        res.locals.user = getUserNameFromRequest(req, cdbRequest);

        checkUserExists(metadataBackend, res.locals.user, function(userExists) {
            if (userExists) {
                return next();
            } else {
                const error = new Error('Unauthorized');
                error.type = 'auth';
                error.subtype = 'user-not-found';
                error.http_status = 404;
                error.message = errorUserNotFoundMessageTemplate(res.locals.user);
                next(error);
            }
        });
    };
};

function getUserNameFromRequest(req, cdbRequest) {
    return cdbRequest.userByReq(req);
}

function checkUserExists(metadataBackend, userName, callback) {
    metadataBackend.getUserId(userName, function(err) {
        callback(!err);
    });
}

function errorUserNotFoundMessageTemplate(user) {
    return `Sorry, we can't find CARTO user '${user}'. Please check that you have entered the correct domain.`;
}
