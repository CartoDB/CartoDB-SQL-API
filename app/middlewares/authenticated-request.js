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
        var params = _.extend({}, req.query, body);

        var authApi = new AuthApi(req, params);
        userDatabaseService.getConnectionParams(authApi, req.context.user, function cancelJob(err, userDatabase) {
            req.profiler.done('setDBAuth');

            if (err) {
                return handleException(err, res);
            }

            if (!userDatabase.authenticated) {
                return handleException(new Error('permission denied'), res);
            }

            req.context.userDatabase = userDatabase;

            return next(null);
        });
    };
}

module.exports = authenticatedMiddleware;
