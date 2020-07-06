'use strict';

module.exports = function timeoutLimits (metadataBackend) {
    return function timeoutLimitsMiddleware (req, res, next) {
        const { user, authorizationLevel } = res.locals;

        metadataBackend.getUserTimeoutRenderLimits(user, function (err, timeoutRenderLimit) {
            req.profiler.done('getUserTimeoutLimits');

            if (err) {
                return next(err);
            }

            const userLimits = {
                timeout: (authorizationLevel === 'master') ? timeoutRenderLimit.render : timeoutRenderLimit.renderPublic
            };

            res.locals.userLimits = userLimits;

            next();
        });
    };
};
