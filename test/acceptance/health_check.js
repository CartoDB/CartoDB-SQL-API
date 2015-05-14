require('../helper');
require('../support/assert');

var assert = require('assert');
var app = require(global.settings.app_root + '/app/controllers/app')();

describe('health checks', function() {

    beforeEach(function(done) {
        global.settings.health = {
            enabled: true
            //username: 'vizzuality',
            //query: 'select 1::text'
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

    it('returns 200 and ok=true with disabled configuration', function(done) {
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

    it('returns 200 and ok=true with enabled configuration', function(done) {
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

});
