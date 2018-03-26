'use strict';

const RATE_LIMIT_ENDPOINTS_GROUPS = {
    QUERY: 'query',
    QUERY_FORMAT: 'query_format',
    JOB_CREATE: 'job_create',
    JOB_GET: 'job_get',
    JOB_DELETE: 'job_delete'
};


function rateLimit(userLimits, endpointGroup = null) {
    if (!isRateLimitEnabled(endpointGroup)) {
        return function rateLimitDisabledMiddleware(req, res, next) { next(); };
    }

    return function rateLimitMiddleware(req, res, next) {
        userLimits.getRateLimit(res.locals.user, endpointGroup, function(err, userRateLimit) {
            if (err) {
                return next(err);
            }
    
            if (!userRateLimit) {
                return next();
            }
    
            const [isBlocked, limit, remaining, retry, reset] = userRateLimit;
    
            res.set({
                'Carto-Rate-Limit-Limit': limit,
                'Carto-Rate-Limit-Remaining': remaining,
                'Retry-After': retry,
                'Carto-Rate-Limit-Reset': reset
            });
    
            if (isBlocked) {
                const rateLimitError = new Error('You are over the limits.');
                rateLimitError.http_status = 429;
                rateLimitError.context = 'limit';
                rateLimitError.detail = 'rate-limit';
                return next(rateLimitError);
            }
    
            return next();
        });
    };
}

function isRateLimitEnabled(endpointGroup) {
    return global.settings.ratelimits.rateLimitsEnabled &&
        endpointGroup &&
        global.settings.ratelimits.endpoints[endpointGroup];
}

module.exports = rateLimit;
module.exports.RATE_LIMIT_ENDPOINTS_GROUPS = RATE_LIMIT_ENDPOINTS_GROUPS;
