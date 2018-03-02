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

function checkResult (status, limit, remaining, reset, retry, done = null) {
    assert.response(
        server, 
        request, 
        { status }, 
        function(err, res) {
            assert.ifError(err);
            assert.equal(res.headers['x-rate-limit-limit'], limit);
            assert.equal(res.headers['x-rate-limit-remaining'], remaining);
            assert.equal(res.headers['x-rate-limit-reset'], reset);
            assert.equal(res.headers['x-rate-limit-retry-after'], retry);

            if (done) {
                setTimeout(done, 1000);
            }
        }
    );
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
        checkResult(200, 2, 1, 1, -1);  
        setTimeout( () => checkResult(200, 2, 0, 1, -1), 250 );
        setTimeout( () => checkResult(429, 2, 0, 1, 0),  500 );
        setTimeout( () => checkResult(429, 2, 0, 1, 0),  750 );
        setTimeout( () => checkResult(429, 2, 0, 1, 0),  950 );
        setTimeout( () => checkResult(200, 2, 0, 1, -1, done), 1050 );
    });

});
