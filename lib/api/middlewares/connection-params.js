'use strict';

module.exports = function connectionParams (userDatabaseService) {
    return function connectionParamsMiddleware (req, res, next) {
        const { user, api_key: apikeyToken, authorizationLevel } = res.locals;

        userDatabaseService.getConnectionParams(user, apikeyToken, authorizationLevel,
            function (err, userDbParams, authDbParams) {
                req.profiler.done('getConnectionParams');

                if (err) {
                    return next(err);
                }

                res.locals.userDbParams = userDbParams;
                res.locals.authDbParams = authDbParams;

                next();
            });
    };
};
