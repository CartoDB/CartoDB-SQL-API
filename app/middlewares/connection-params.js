module.exports = function connectionParams (userDatabaseService) {
    return function connectionParamsMiddleware (req, res, next) {
        const { user, api_key: apikeyToken, authenticated } = res.locals;

        userDatabaseService.getConnectionParams(user, apikeyToken, authenticated,
            function (err, userDbParams, authDbParams) {
            if (req.profiler) {
                req.profiler.done('getConnectionParams');
            }

            if (err) {
                return next(err);
            }

            res.locals.userDbParams = userDbParams;
            res.locals.authDbParams = authDbParams;

            next();
        });
    };
};
