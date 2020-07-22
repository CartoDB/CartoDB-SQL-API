'use strict';

const CdbRequest = require('../../models/cartodb-request');

module.exports = function user (metadataBackend) {
    const cdbRequest = new CdbRequest();

    return function userMiddleware (req, res, next) {
        try {
            res.locals.user = getUserNameFromRequest(req, cdbRequest);
            res.set('Carto-User', res.locals.user);
        } catch (err) {
            return next(err);
        }

        metadataBackend.getUserId(res.locals.user, (err, userId) => {
            if (err || !userId) {
                const error = new Error('Unauthorized');
                error.type = 'auth';
                error.subtype = 'user-not-found';
                error.http_status = 404;
                error.message = errorUserNotFoundMessageTemplate(res.locals.user);

                return next(error);
            }

            res.locals.userId = userId;
            res.set('Carto-User-Id', `${userId}`);
            res.locals.logger = res.locals.logger.child({ 'cdb-user': res.locals.user });
            return next();
        });
    };
};

function getUserNameFromRequest (req, cdbRequest) {
    return cdbRequest.userByReq(req);
}

function errorUserNotFoundMessageTemplate (user) {
    return `Sorry, we can't find CARTO user '${user}'. Please check that you have entered the correct domain.`;
}
