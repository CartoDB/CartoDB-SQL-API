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

describe('job module', function() {
    var job = {};

    it('POST /api/v2/job', function (done){
        assert.response(app, {
            url: '/api/v2/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 200
        }, function(res) {
            job = JSON.parse(res.body);
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.ok(job.job_id);
            assert.equal(job.query, "SELECT * FROM untitle_table_4");
            assert.equal(job.user, "vizzuality");
            done();
        });
    });

    it('GET /api/v2/job/:job_id', function (done){
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 200
        }, function(res) {
            var jobGot = JSON.parse(res.body);
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.equal(jobGot.query, "SELECT * FROM untitle_table_4");
            assert.equal(jobGot.user, "vizzuality");
            done();
        });
    });

    it('GET /api/v2/job/', function (done){
        assert.response(app, {
            url: '/api/v2/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 200
        }, function(res) {
            var jobs = JSON.parse(res.body);
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.ok(jobs instanceof Array);
            assert.ok(jobs.length > 0);
            assert.ok(jobs[0].job_id);
            assert.ok(jobs[0].status);
            assert.ok(jobs[0].query);
            done();
        });
    });
});
