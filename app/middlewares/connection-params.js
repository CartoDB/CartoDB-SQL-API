module.exports = function connectionParams (userDatabaseService) {
    return function connectionParamsMiddleware (req, res, next) {
        const { user, api_key: apikeyToken, authenticated } = res.locals;

        userDatabaseService.getConnectionParams(user, apikeyToken, authenticated,
            function (err, userDbParams, authDbParams, userLimits) {
            if (req.profiler) {
                req.profiler.done('setDBAuth');
            }

            if (err) {
                return next(err);
            }

            res.locals.userDbParams = userDbParams;
            res.locals.authDbParams = authDbParams;
            res.locals.userLimits = userLimits;

            next();
        });
    };
};
