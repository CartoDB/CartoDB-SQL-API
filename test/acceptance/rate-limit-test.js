'use strict';

require('../helper');

const qs = require('querystring');
const assert = require('../support/assert');
const redis = require('redis');
const rateLimitMiddleware = require('../../lib/api/middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitMiddleware;

const app = require('../../lib/server');
let server;

let redisClient;
const keysToDelete = [];
const user = 'vizzuality';

var request = {
    url: '/api/v1/sql?' + qs.stringify({
        q: 'SELECT * FROM untitle_table_4'
    }),
    headers: {
        host: 'vizzuality.cartodb.com'
    },
    method: 'GET'
};

function setLimit (count, period, burst) {
    redisClient.SELECT(8, err => {
        if (err) {
            return;
        }

        const key = `limits:rate:store:${user}:sql:${RATE_LIMIT_ENDPOINTS_GROUPS.QUERY}`;
        redisClient.rpush(key, burst);
        redisClient.rpush(key, count);
        redisClient.rpush(key, period);
        keysToDelete.push(key);
    });
}

function assertRequest (status, limit, remaining, reset, retry, done = null) {
    assert.response(
        server,
        request,
        { status },
        function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.headers['carto-rate-limit-limit'], limit);
            assert.strictEqual(res.headers['carto-rate-limit-remaining'], remaining);
            assert.strictEqual(res.headers['carto-rate-limit-reset'], reset);

            if (retry) {
                assert.strictEqual(res.headers['retry-after'], retry);
            }

            if (status === 429) {
                const expectedResponse = {
                    error: ['You are over platform\'s limits. Please contact us to know more details'],
                    context: 'limit',
                    detail: 'rate-limit'
                };

                assert.deepStrictEqual(JSON.parse(res.body), expectedResponse);
            }

            if (done) {
                setTimeout(done, 1000);
            }
        }
    );
}

describe('rate limit', function () {
    before(function () {
        global.settings.ratelimits.rateLimitsEnabled = true;
        global.settings.ratelimits.endpoints.query = true;

        server = app();
        redisClient = redis.createClient({
            port: global.settings.redis_port,
            host: global.settings.redis_host
        });

        const count = 1;
        const period = 1;
        const burst = 1;
        setLimit(count, period, burst);
    });

    after(function () {
        global.settings.ratelimits.rateLimitsEnabled = false;
        global.settings.ratelimits.endpoints.query = false;

        keysToDelete.forEach(key => {
            redisClient.del(key);
        });
    });

    it('1 req/sec: 2 req/seg should be limited', function (done) {
        assertRequest(200, '2', '1', '1');
        setTimeout(() => assertRequest(200, '2', '0', '1', null), 250);
        setTimeout(() => assertRequest(429, '2', '0', '1', '1'), 500);
        setTimeout(() => assertRequest(429, '2', '0', '1', '1'), 750);
        setTimeout(() => assertRequest(429, '2', '0', '1', '1'), 950);
        setTimeout(() => assertRequest(200, '2', '0', '1', null, done), 1050);
    });
});
