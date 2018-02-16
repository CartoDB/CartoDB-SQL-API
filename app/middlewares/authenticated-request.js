'use strict';

var _ = require('underscore');
var AuthApi = require('../auth/auth_api');
var handleException = require('../utils/error_handler');

function authenticatedMiddleware(userDatabaseService) {
    return function middleware(req, res, next) {
        req.profiler.start('sqlapi.job');
        req.profiler.done('init');

        var body = (req.body) ? req.body : {};
        // clone so don't modify req.params or req.body so oauth is not broken
        var params = _.extend({}, res.locals, req.query, body);

        var authApi = new AuthApi(req, res, params);
        userDatabaseService.getConnectionParams(authApi, res.locals.user, function connectionParams(err, userDbParams) {
            req.profiler.done('setDBAuth');

            if (err) {
                return handleException(err, res);
            }

            if (!userDbParams.authenticated) {
                return handleException(new Error('permission denied'), res);
            }

            res.locals.userDbParams = userDbParams;

            return next(null);
        });
    };
}

module.exports = authenticatedMiddleware;
