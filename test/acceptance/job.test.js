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

describe('job.test', function() {

    it('GET /api/v2/job', function (done){
        assert.response(app, {
            url: '/api/v2/job',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {
            status: 400
        }, function(res) {
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.deepEqual(res.headers['content-disposition'], 'inline');
            assert.deepEqual(JSON.parse(res.body), {"error":["You must indicate a sql query"]});
            done();
        });
    });

    it('GET /api/v2/job with SQL parameter on SELECT no database param,just id using headers', function(done){
        assert.response(app, {
            url: '/api/v2/job?q=SELECT%20*%20FROM%20untitle_table_4',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {
        }, function (res) {
            assert.equal(res.statusCode, 200, res.body);
            done();
        });
    });
});
