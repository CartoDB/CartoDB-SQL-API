require('../helper');

const qs = require('querystring');
const assert = require('../support/assert');
const redis = require('redis');
const UserLimits = require('../../app/services/user_limits');
const rateLimitMiddleware = require('../../app/middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitMiddleware;

const app = require('../../app/server');
let server;

let redisClient;
let keysToDelete = [];
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


function setLimit(count, period, burst) {
    redisClient.SELECT(8, err => {
        if (err) {
            return;
        }

        const key = UserLimits.getRateLimitsStoreKey(user, RATE_LIMIT_ENDPOINTS_GROUPS.QUERY);        
        redisClient.rpush(key, burst);
        redisClient.rpush(key, count);
        redisClient.rpush(key, period);
        keysToDelete.push(key);
    });
}

describe('rate limit', function() {
    before(function() {
        global.settings.ratelimits.rateLimitsEnabled = true;
        global.settings.ratelimits.endpoints.query = true;
        
        server = app();
        redisClient = redis.createClient(global.settings.redis_port);

        const count = 1;
        const period = 1;
        const burst = 1;
        setLimit(count, period, burst);
    });

    after(function() {
        global.settings.ratelimits.rateLimitsEnabled = false;
        global.settings.ratelimits.endpoints.query = false;

        keysToDelete.forEach( key => {
            redisClient.del(key);
        });
    });

    it("1 req/sec: 2 req/seg should be limited", function(done) {
        assert.response(
            server, 
            request, 
            { status: 200 }, 
            function(err, res) {
                assert.ifError(err);
                assert.equal(res.headers['x-rate-limit-limit'], '2');
                assert.equal(res.headers['x-rate-limit-remaining'], '1');
                assert.equal(res.headers['x-rate-limit-reset'], '1');
                assert.equal(res.headers['x-rate-limit-retry-after'], '-1');
            }
        );

        setTimeout(
            function() {
                assert.response(
                    server, 
                    request, 
                    { status: 200 }, 
                    function(err, res) {
                        assert.ifError(err);
                        assert.equal(res.headers['x-rate-limit-limit'], '2');
                        assert.equal(res.headers['x-rate-limit-remaining'], '0');
                        assert.equal(res.headers['x-rate-limit-reset'], '1');
                        assert.equal(res.headers['x-rate-limit-retry-after'], '-1');
                    }
                );
            },
            250
        );

        setTimeout(
            function() {
                assert.response(
                    server, 
                    request, 
                    { status: 429 }, 
                    function(err, res) {
                        assert.ifError(err);
                        assert.equal(res.headers['x-rate-limit-limit'], '2');
                        assert.equal(res.headers['x-rate-limit-remaining'], '0');
                        assert.equal(res.headers['x-rate-limit-reset'], '1');
                        assert.equal(res.headers['x-rate-limit-retry-after'], '0');
                    }
                );
            },
            500
        );

        setTimeout(
            function() {
                assert.response(
                    server, 
                    request, 
                    { status: 429 }, 
                    function(err, res) {
                        assert.ifError(err);
                        assert.equal(res.headers['x-rate-limit-limit'], '2');
                        assert.equal(res.headers['x-rate-limit-remaining'], '0');
                        assert.equal(res.headers['x-rate-limit-reset'], '1');
                        assert.equal(res.headers['x-rate-limit-retry-after'], '0');
                    }
                );
            },
            750
        );

        setTimeout(
            function() {
                assert.response(
                    server, 
                    request, 
                    { status: 429 }, 
                    function(err, res) {
                        assert.ifError(err);
                        assert.equal(res.headers['x-rate-limit-limit'], '2');
                        assert.equal(res.headers['x-rate-limit-remaining'], '0');
                        assert.equal(res.headers['x-rate-limit-reset'], '1');
                        assert.equal(res.headers['x-rate-limit-retry-after'], '0');
                    }
                );
            },
            950
        );
        
        setTimeout(
            function() {
                assert.response(
                    server, 
                    request, 
                    { status: 200 }, 
                    function(err, res) {
                        assert.ifError(err);
                        assert.equal(res.headers['x-rate-limit-limit'], '2');
                        assert.equal(res.headers['x-rate-limit-remaining'], '0');
                        assert.equal(res.headers['x-rate-limit-reset'], '1');
                        assert.equal(res.headers['x-rate-limit-retry-after'], '-1');
                        setTimeout(done, 1000);
                    }
                );
            },
            1050
        );
    });

});
