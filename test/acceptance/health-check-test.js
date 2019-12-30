'use strict';

require('../helper');
require('../support/assert');

var assert = require('assert');
var server = require('../../lib/server')();

describe('health checks', function () {
    beforeEach(function (done) {
        global.settings.health = {
            enabled: true
            // username: 'vizzuality',
            // query: 'select 1::text'
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

    it('returns 200 and ok=true with disabled configuration', function (done) {
        global.settings.health.enabled = false;

        assert.response(server,
            healthCheckRequest,
            {
                status: 200
            },
            function (err, res) {
                assert.ok(!err);

                var parsed = JSON.parse(res.body);

                assert.strictEqual(parsed.enabled, false);
                assert.ok(parsed.ok);

                done();
            }
        );
    });

    it('returns 200 and ok=true with enabled configuration', function (done) {
        assert.response(server,
            healthCheckRequest,
            {
                status: 200
            },
            function (err, res) {
                assert.ok(!err);

                var parsed = JSON.parse(res.body);

                assert.ok(parsed.enabled);
                assert.ok(parsed.ok);

                done();
            }
        );
    });
});
