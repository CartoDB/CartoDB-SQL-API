module.exports = function timeoutLimits (metadataBackend) {
    return function timeoutLimitsMiddleware (req, res, next) {
        const { user, authenticated } = res.locals;

        metadataBackend.getUserTimeoutRenderLimits(user, function (err, timeoutRenderLimit) {
            if (req.profiler) {
                req.profiler.done('getUserTimeoutLimits');
            }

            if (err) {
                return next(err);
            }

            const userLimits = {
                timeout: authenticated ? timeoutRenderLimit.render : timeoutRenderLimit.renderPublic
            };

            res.locals.userLimits = userLimits;

            next();
        });
    };
};
