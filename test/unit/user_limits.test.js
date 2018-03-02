require('../helper');

const assert = require('assert');
const RedisPool = require('redis-mpool');
const cartodbRedis = require('cartodb-redis');
const UserLimits = require('../../app/services/user_limits');
const { getLowerRateLimit, RATE_LIMIT_REDIS_DB } = UserLimits;
const { RATE_LIMIT_ENDPOINTS_GROUPS } = require('../../app/middlewares/rate-limit');

let userLimits;
let metadataBackend;
let redisKey;
const user = 'vizzuality';


describe('Lower rate limit', function () {
    it("1 limit: not limited", function (done) {
        const limits = [[0, 3, 1, -1, 1]];
        const result = getLowerRateLimit(limits);
        assert.deepEqual(limits[0], result);
        done();
    });

    it("1 limit: limited", function (done) {
        const limits = [[1, 3, 0, 0, 1]];
        const result = getLowerRateLimit(limits);
        assert.deepEqual(limits[0], result);
        done();
    });

    it("empty or invalid", function (done) {
        let limits = [];
        let result = getLowerRateLimit(limits);
        assert.deepEqual(null, result);

        limits = undefined;
        result = getLowerRateLimit(limits);
        assert.deepEqual(null, result);

        limits = null;
        result = getLowerRateLimit(limits);
        assert.deepEqual(null, result);

        limits = [[]];
        result = getLowerRateLimit(limits);
        assert.deepEqual(null, result);

        limits = [[], []];
        result = getLowerRateLimit(limits);
        assert.deepEqual(null, result);

        limits = {};
        result = getLowerRateLimit(limits);
        assert.deepEqual(null, result);

        limits = [{}];
        result = getLowerRateLimit(limits);
        assert.deepEqual(null, result);

        limits = [[1, 2]];
        result = getLowerRateLimit(limits);
        assert.deepEqual(null, result);

        done();
    });

    it("multiple limits: valid and invalid", function (done) {
        const limit1 = [0, 3, 0];
        const limit2 = [0, 3, 1, 0, 1];

        let limits = [limit1, limit2];
        let result = getLowerRateLimit(limits);
        assert.deepEqual(limit2, result);

        limits = [limit2, limit1];
        result = getLowerRateLimit(limits);
        assert.deepEqual(limit2, result);

        done();
    });

    it("multiple limits: not limited", function (done) {
        const limit1 = [0, 3, 2, 0, 1];
        const limit2 = [0, 3, 3, 0, 1];
        const limit3 = [0, 3, 1, 0, 1];
        const limit4 = [0, 3, 4, 0, 1];
        const limit5 = [0, 3, 5, 0, 1];

        let limits = [limit1, limit2, limit3, limit4, limit5];
        let result = getLowerRateLimit(limits);
        assert.deepEqual(limit3, result);

        limits = [limit1, limit2];
        result = getLowerRateLimit(limits);
        assert.deepEqual(limit1, result);

        done();
    });

    it("multiple limits: limited", function (done) {
        const limit1 = [0, 3, 2, 0, 1];
        const limit2 = [0, 3, 3, 0, 1];
        const limit3 = [0, 3, 1, 0, 1];
        const limit4 = [0, 3, 4, 0, 1];
        const limit5 = [1, 3, 5, 0, 1];

        let limits = [limit1, limit2, limit3, limit4, limit5];
        let result = getLowerRateLimit(limits);
        assert.deepEqual(limit5, result);

        limits = [limit1, limit2, limit5, limit3, limit4];
        result = getLowerRateLimit(limits);
        assert.deepEqual(limit5, result);

        done();
    });
});


describe('eval and evalsha', function () {
    before(function (done) {
        global.settings.ratelimits.rateLimitsEnabled = true;
        global.settings.ratelimits.endpoints.query = true;

        const redisPool = new RedisPool({
            name: 'sql-api',
            host: global.settings.redis_host,
            port: global.settings.redis_port,
            max: global.settings.redisPool,
            idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
            reapIntervalMillis: global.settings.redisReapIntervalMillis
        });
        metadataBackend = cartodbRedis({ pool: redisPool });

        const userLimitsServiceOptions = {
            limits: {
                rateLimitsEnabled: global.settings.ratelimits.rateLimitsEnabled
            }
        };
        userLimits = new UserLimits(metadataBackend, userLimitsServiceOptions);

        redisKey = UserLimits.getRateLimitsStoreKey(user, RATE_LIMIT_ENDPOINTS_GROUPS.QUERY);
        metadataBackend.redisCmd(RATE_LIMIT_REDIS_DB, 'LRANGE', [redisKey, 0, -1], () => {
            metadataBackend.redisCmd(RATE_LIMIT_REDIS_DB, 'RPUSH', [redisKey, 10], () => {
                metadataBackend.redisCmd(RATE_LIMIT_REDIS_DB, 'RPUSH', [redisKey, 10], () => {
                    metadataBackend.redisCmd(RATE_LIMIT_REDIS_DB, 'RPUSH', [redisKey, 1], () => {
                        done();
                    });
                });
            });
        });
    });

    after(function (done) {
        global.settings.ratelimits.rateLimitsEnabled = false;
        global.settings.ratelimits.endpoints.query = false;

        metadataBackend.redisCmd(RATE_LIMIT_REDIS_DB, 'DEL', [redisKey], () => {
            done();
        });
    });

    it("should work before and after removing SHA script from Redis", function (done) {
        userLimits.getRateLimit(user, RATE_LIMIT_ENDPOINTS_GROUPS.QUERY, (err, rateLimit) => {
            assert.ifError(err);
            assert.deepEqual(rateLimit, [0, 11, 10, -1, 0]);

            metadataBackend.redisCmd(
                8, 
                'SCRIPT', 
                ['FLUSH'], 
                function () {
                    userLimits.getRateLimit(user, RATE_LIMIT_ENDPOINTS_GROUPS.QUERY, (err, rateLimit) => {
                        assert.ifError(err);
                        assert.deepEqual(rateLimit, [0, 11, 9, -1, 0]);
                        done();
                    });
                }
            );
        });

    });
});