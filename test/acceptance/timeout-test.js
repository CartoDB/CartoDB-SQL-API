'use strict';

/**
 *
 * Requires the database and tables setup in config/environments/test.js to exist
 * Ensure the user is present in the pgbouncer auth file too
 * TODO: Add OAuth tests.
 *
 * To run this test, ensure that cartodb_test_user_1_db metadata exists
 * in Redis for the vizzuality.cartodb.com domain
 *
 * SELECT 5
 * HSET rails:users:vizzuality id 1
 * HSET rails:users:vizzuality database_name cartodb_test_user_1_db
 *
 */
require('../helper');

var assert = require('../support/assert');
var step = require('step');
var server = require('../../lib/server');

describe('timeout', function () {
// See https://github.com/CartoDB/CartoDB-SQL-API/issues/128
    it('after configured milliseconds', function (done) {
        var testTimeout = 1;
        var timeoutBackup = global.settings.node_socket_timeout;
        global.settings.node_socket_timeout = testTimeout;
        step(
            function sendLongQuery () {
                assert.response(server(), {
                    url: '/api/v1/sql?q=SELECT+count(*)+FROM+generate_series(1,100000)',
                    method: 'GET',
                    headers: { host: 'vizzuality.localhost' }
                }, {}, this);
            },
            function checkResponse (err/*, res */) {
                assert.ok(err);
                assert.ok(err.message.match(/hang up/), err);
                return null;
            },
            function finish (err) {
                global.settings.node_socket_timeout = timeoutBackup;
                done(err);
            }
        );
    });

    // TODO: check that the query is interrupted on timeout!
    // See #129
});
