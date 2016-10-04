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

var server = require('../../app/server')();
var assert = require('../support/assert');
var redisUtils = require('../support/redis_utils');
var querystring = require('querystring');
var metadataBackend = require('cartodb-redis')(redisUtils.getConfig());
var batchFactory = require('../../batch');

describe('Use case 2: cancel a running job', function() {
    var batch = batchFactory(metadataBackend, redisUtils.getConfig());

    before(function (done) {
        batch.start();
        batch.on('ready', done);
    });

    after(function (done) {
        batch.stop();
        redisUtils.clean('batch:*', done);
    });

    var runningJob = {};
    var cancelledJob = {};

    it('Step 1, should create a new job', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4; select pg_sleep(3)"
            })
        }, {
            status: 201
        }, function(err, res) {
            runningJob = JSON.parse(res.body);
            done();
        });
    });

    it('Step 2, job should be running', function (done){
        var interval = setInterval(function () {
            assert.response(server, {
                url: '/api/v2/sql/job/' + runningJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'GET'
            }, {
                status: 200
            }, function(err, res) {
                var job = JSON.parse(res.body);
                if (job.status === "running") {
                    clearInterval(interval);
                    done();
                } else if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
                    clearInterval(interval);
                    done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                }
            });
        }, 50);
    });

    it('Step 3, cancel a job', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job/' + runningJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 200
        }, function(err, res) {
            cancelledJob = JSON.parse(res.body);
            assert.equal(cancelledJob.status, "cancelled");
            done();
        });
    });

    it('Step 4, job should be cancelled', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job/' + runningJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 200
        }, function(err, res) {
            var job = JSON.parse(res.body);
            if (job.status === "cancelled") {
                done();
            } else {
                done(new Error('Job status is not cancelled, ' + job.status));
            }
        });
    });

    it('Step 5, cancel a cancelled should give an error', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job/' + cancelledJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 400
        }, function(err, res) {
            var errors = JSON.parse(res.body);
            assert.equal(errors.error[0], "Cannot set status from cancelled to cancelled");
            done();
        });
    });
});
