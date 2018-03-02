const RATE_LIMIT_REDIS_DB = 8;
const getRateLimitLuaScript = `
    local results = {}
    local resultsCounter = 0

    local limits = {}
    local limitsArray = redis.call("LRANGE", KEYS[1], 0, -1)
     
    for i, v in ipairs(limitsArray) do
        local rest = i % 3
        if rest ~= 0 then
            limits[rest] = v
        else
            resultsCounter = resultsCounter + 1
            results[resultsCounter] = redis.call("CL.THROTTLE", KEYS[2], limits[1], limits[2], v)
        end
    end
 
    return results
`;

/**
 * UserLimits
 * @param {cartodb-redis} metadataBackend 
 * @param {object} options 
 */
class UserLimits {
    constructor(metadataBackend, options = {}) {
        this.metadataBackend = metadataBackend;
        this.options = options;

        this.rateLimits = {
            redisCommand: 'EVAL',
            sha: null,
            lua: getRateLimitLuaScript
        };

        this.preprareRateLimit();
    }

    /**
     * Returns Redis key where the limits are saved by user and endpoint
     * The value is a Redis hash:
     *    maxBurst (b): Integer (as string)
     *    countPerPeriod (c): Integer (as string)
     *    period (p): Integer (as string)
     * @param {string} user 
     * @param {string} endpointGroup 
     */
    static getRateLimitsStoreKey(user, endpointGroup) {
        return `limits:rate:store:${user}:sql:${endpointGroup}`;
    }

    /**
     * Returns Redis key where the current state of the limit by user and endpoint 
     * This key is managed by redis-cell (CL.THROTTLE command)
     * @param {string} user 
     * @param {string} endpointGroup 
     */
    static getRateLimitStatusKey(user, endpointGroup) {
        return `limits:rate:status:${user}:sql:${endpointGroup}`;
    }

    /**
     * Returns the inner rateLimit what is the strictest one
     * @param {Array} rateLimits Each inner array has 5 integers indicating: 
     *      isBloqued, limit, remaining, retry, reset
     */
    static getLowerRateLimit(rateLimits) {
        /*jshint maxcomplexity:10 */
        if (!Array.isArray(rateLimits) || !rateLimits.length) {
            return;
        }
    
        let minIndex;
        let minRemainingValue;
        for (let currentIndex = 0; currentIndex < rateLimits.length; currentIndex++) {
            const rateLimit = rateLimits[currentIndex];
            if (!UserLimits.validateRatelimit(rateLimit)) {
                continue;
            }
    
            const [isBlocked, , remaining] = rateLimit;
    
            if (isBlocked === 1) {
                minIndex = currentIndex;
                break;
            }
    
            if (minRemainingValue === undefined || remaining < minRemainingValue) {
                minIndex = currentIndex;
                minRemainingValue = remaining;
            }
        }
    
        if (rateLimits[minIndex]) {
            return rateLimits[minIndex];
        } else {
            return;
        }
    }

    static validateRatelimit(rateLimit) {
        return rateLimit.length === 5;
    }

    preprareRateLimit() {
        var self = this;

        if (this.options.limits.rateLimitsEnabled) {
            this.metadataBackend.redisCmd(
                RATE_LIMIT_REDIS_DB,
                'SCRIPT',
                ['LOAD', getRateLimitLuaScript],
                (err, sha) => {
                    if (!err && sha) {
                        self.rateLimits.sha = sha;
                        self.rateLimits.redisCommand = 'EVALSHA';
                    }
                }
            );
        }
    }

    getRateLimit(user, endpointGroup, callback) {
        var self = this;

        let redisParams = [
            this.rateLimits.redisCommand === 'EVAL' ? this.rateLimits.lua : this.rateLimits.sha,
            2,
            UserLimits.getRateLimitsStoreKey(user, endpointGroup),    // KEY[1] 
            UserLimits.getRateLimitStatusKey(user, endpointGroup)     // KEY[2]
        ];

        this.metadataBackend.redisCmd(
            RATE_LIMIT_REDIS_DB,
            this.rateLimits.redisCommand,
            redisParams,
            (err, rateLimits) => {
                if (err) {
                    if (err.name === 'ReplyError' && err.message === 'NOSCRIPT No matching script. Please use EVAL.') {
                        self.rateLimits.redisCommand = 'EVAL';
                        return self.getRateLimit(user, endpointGroup, callback);
                    } else {
                        callback(err);
                    }
                }
    
                callback(null, UserLimits.getLowerRateLimit(rateLimits));
            }
        );
    }
}

module.exports = UserLimits;
module.exports.RATE_LIMIT_REDIS_DB = RATE_LIMIT_REDIS_DB;
