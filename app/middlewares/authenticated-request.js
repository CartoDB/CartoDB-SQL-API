const AuthApi = require('../auth/auth_api');

module.exports = function authenticatedRequest (userDatabaseService, forceToBeAuthenticated = false) {
    return function authenticatedRequestMiddleware (req, res, next) {
        const params = Object.assign({}, res.locals, req.query, req.body);
        const { user } = res.locals;
        const authApi = new AuthApi(req, res, params);

        userDatabaseService.getConnectionParams(authApi, user, function (err, dbParams, authDbParams, userLimits) {
            if (req.profiler) {
                req.profiler.done('setDBAuth');
            }

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
};
