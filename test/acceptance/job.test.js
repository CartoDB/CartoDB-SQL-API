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

var app = require(global.settings.app_root + '/app/app')();
var assert = require('../support/assert');
var querystring = require('querystring');

describe('job', function() {

    it('POST /api/v2/job', function (done){
        assert.response(app, {
            url: '/api/v2/job',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 200
        }, function(res) {
            var job = JSON.parse(res.body);
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.equal(job.query, "SELECT * FROM untitle_table_4");
            assert.equal(job.status, "pending");
            assert.equal(job.user, "vizzuality");
            done();
        });
    });

});
