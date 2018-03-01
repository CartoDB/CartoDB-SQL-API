'use strict';

const RATE_LIMIT_ENDPOINTS_GROUPS = {
    QUERY: 'query',
    QUERY_FORMAT: 'query_format',
    JOB_CREATE: 'job_create',
    JOB_GET: 'job_get',
    JOB_DELETE: 'job_delete'
};


function rateLimitFn(userLimits, endpointGroup = null) {
    return function rateLimitMiddleware(req, res, next) {
        if (!global.settings.ratelimits.rateLimitsEnabled) {
            return next();
        }

        const user = res.locals.user;

        if (!endpointGroup || !isRateLimitEnabledByEndpoint(endpointGroup)) {
            return next();
        }

        userLimits.getRateLimit(user, endpointGroup, function(err, rateLimit) {
            if (err) {
                return next(err);
            }
    
            if (!rateLimit) {
                return next();
            }
    
            const [isBlocked, limit, remaining, retry, reset] = rateLimit;
    
            res.set({
                'X-Rate-Limit-Limit': limit,
                'X-Rate-Limit-Remaining': remaining,
                'X-Rate-Limit-Retry-After': retry,
                'X-Rate-Limit-Reset': reset
            });
    
            if (isBlocked) {
                const rateLimitError = new Error('You are over the limits.');
                rateLimitError.http_status = 429;
                return next(rateLimitError);
            }
    
            return next();
        });
    };
}


function isRateLimitEnabledByEndpoint(endpointGroup) {
    return global.settings.ratelimits.endpoints[endpointGroup] === true;
}


module.exports = rateLimitFn;
module.exports.RATE_LIMIT_ENDPOINTS_GROUPS = RATE_LIMIT_ENDPOINTS_GROUPS;
