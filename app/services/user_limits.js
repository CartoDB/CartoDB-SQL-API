const DEFAULT_RATE_LIMITS_OPTIONS = {
    rateLimitsEnabled: false,
    endpoints: {
        query: false,
        query_format: false,
        job_create: false,
        job_get: false,
        job_delete: false
    }
};

/**
 * UserLimits
 * @param {cartodb-redis} metadataBackend 
 * @param {object} options 
 */
class UserLimits {
    constructor(metadataBackend, options = {}) {
        this.metadataBackend = metadataBackend;
        this.options = options;

        this.preprareRateLimit();
    }

    static configure() {
        // default rate limits
        global.settings.ratelimits = Object.assign({}, DEFAULT_RATE_LIMITS_OPTIONS, global.settings.ratelimits);
    }

    preprareRateLimit() {
        if (this.options.limits.rateLimitsEnabled) {
            this.metadataBackend.loadRateLimitsScript();
        }
    }

    getRateLimit(user, endpointGroup, callback) {
        this.metadataBackend.getRateLimit(user, 'sql', endpointGroup, callback);
    }
}

module.exports = UserLimits;
