'use strict';

var _ = require('underscore');
var AuthApi = require('../auth/auth_api');

function authenticatedMiddleware(userDatabaseService, forceToBeAuthenticated = false) {
    return function middleware(req, res, next) {
        req.profiler.start('sqlapi.job');
        req.profiler.done('init');

        // clone so don't modify req.params or req.body so oauth is not broken
        const params = _.extend({}, res.locals, req.query, req.body);

        const { user } = res.locals;

        var authApi = new AuthApi(req, res, params);
        userDatabaseService.getConnectionParams(authApi, user, function (err, dbParams, authDbParams, userLimits) {
            req.profiler.done('setDBAuth');

            if (err) {
                return next(err);
            }

            if (forceToBeAuthenticated && !dbParams.authenticated) {
                return next(new Error('permission denied'));
            }

            res.locals.userDbParams = dbParams;
            res.locals.authDbParams = authDbParams;
            res.locals.userLimits = userLimits;

            next();
        });
    };
}

module.exports = authenticatedMiddleware;
