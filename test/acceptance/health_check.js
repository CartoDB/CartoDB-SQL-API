require('../helper');
require('../support/assert');

var assert = require('assert'),
    App = require(global.settings.app_root + '/app/controllers/app');

var app = App();

suite('health checks', function() {

    beforeEach(function(done) {
        global.settings.health = {
            enabled: true,
            username: 'vizzuality',
            query: 'select 1::text'
        };
        done();
    });

    var healthCheckRequest = {
        url: '/api/v1/health',
        method: 'GET',
        headers: {
            host: 'vizzuality.localhost'
        }
    };

    test('returns 200 and ok=true with disabled configuration', function(done) {
        global.settings.health.enabled = false;

        assert.response(app,
            healthCheckRequest,
            {
                status: 200
            },
            function(res, err) {
                assert.ok(!err);

                var parsed = JSON.parse(res.body);

                assert.equal(parsed.enabled, false);
                assert.ok(parsed.ok);

                done();
            }
        );
    });

    test('returns 200 and ok=true with enabled configuration', function(done) {
        assert.response(app,
            healthCheckRequest,
            {
                status: 200
            },
            function(res, err) {
                assert.ok(!err);

                var parsed = JSON.parse(res.body);

                assert.ok(parsed.enabled);
                assert.ok(parsed.ok);

                done();
            }
        );
    });

    test('fails for invalid user because it is not in redis', function(done) {
        global.settings.health.username = 'invalid';

        assert.response(app,
            healthCheckRequest,
            {
                status: 503
            },
            function(res, err) {
                assert.ok(!err);

                var parsed = JSON.parse(res.body);

                assert.equal(parsed.enabled, true);
                assert.equal(parsed.ok, false);

                assert.equal(parsed.result.redis.ok, false);

                done();
            }
        );
    });

    test('fails for wrong query', function(done) {
        global.settings.health.query = 'select wadus query';

        assert.response(app,
            healthCheckRequest,
            {
                status: 503
            },
            function(res, err) {
                assert.ok(!err);

                var parsed = JSON.parse(res.body);

                assert.equal(parsed.enabled, true);
                assert.equal(parsed.ok, false);

                assert.ok(parsed.result.redis.ok);

                assert.equal(parsed.result.postgresql.ok, false);

                done();
            }
        );
    });

});
