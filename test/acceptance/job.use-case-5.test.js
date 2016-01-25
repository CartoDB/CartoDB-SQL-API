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
var metadataBackend = require('cartodb-redis')({
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
});
var batchFactory = require('../../batch');

describe('Use case 5: modify a running job', function() {

    var batch = batchFactory(metadataBackend);

    before(function () {
        batch.start();
    });

    after(function () {
        batch.stop();
    });

    var runningJob = {};

    it('Step 1, should create job', function (done) {
        assert.response(app, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4; select pg_sleep(5)"
            })
        }, {
            status: 201
        }, function (res) {
            runningJob = JSON.parse(res.body);
            done();
        });
    });

    it('Step 2, job should be running', function (done){
        var interval = setInterval(function () {
            assert.response(app, {
                url: '/api/v2/sql/job/' + runningJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'GET'
            }, {
                status: 200
            }, function(res) {
                var job = JSON.parse(res.body);
                if (job.status === "running") {
                    clearInterval(interval);
                    done();
                }
            });
        }, 50);
    });

    it('Step 3, modify a running job should give an error', function (done){
        assert.response(app, {
            url: '/api/v2/sql/job/' + runningJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PUT',
            data: querystring.stringify({
                query: "SELECT cartodb_id FROM untitle_table_4"
            })
        }, {
            status: 400
        }, function(res) {
            var errors = JSON.parse(res.body);
            assert.equal(errors.error[0], "Job is not pending, it couldn't be updated");
            done();
        });
    });

    it('Step 4, running job should be cancelled', function (done){
        assert.response(app, {
            url: '/api/v2/sql/job/' + runningJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 200
        }, function(res) {
            var cancelledJob = JSON.parse(res.body);
            assert.equal(cancelledJob.status, "cancelled");
            done();
        });
    });

    it('Step 5, modify again a cancelled job should give an error', function (done){
        assert.response(app, {
            url: '/api/v2/sql/job/' + runningJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PUT',
            data: querystring.stringify({
                query: "SELECT cartodb_id FROM untitle_table_4"
            })
        }, {
            status: 400
        }, function(res) {
            var errors = JSON.parse(res.body);
            assert.equal(errors.error[0], "Job is not pending, it couldn't be updated");
            done();
        });
    });
});