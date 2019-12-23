'use strict';

/**
 * UserLimits
 * @param {cartodb-redis} metadataBackend
 * @param {object} options
 */
class UserLimits {
    constructor (metadataBackend, options = {}) {
        this.metadataBackend = metadataBackend;
        this.options = options;

        this.preprareRateLimit();
    }

    preprareRateLimit () {
        if (this.options.limits.rateLimitsEnabled) {
            this.metadataBackend.loadRateLimitsScript();
        }
    }

    getRateLimit (user, endpointGroup, callback) {
        this.metadataBackend.getRateLimit(user, 'sql', endpointGroup, callback);
    }
}

module.exports = UserLimits;
