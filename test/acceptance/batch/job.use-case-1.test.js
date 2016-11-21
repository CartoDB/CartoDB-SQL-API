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
require('../../helper');

var server = require('../../../app/server')();
var assert = require('../../support/assert');
var redisUtils = require('../../support/redis_utils');
var querystring = require('querystring');
var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var batchFactory = require('../../../batch/index');

describe.skip('Use case 1: cancel and modify a done job', function () {
    var batch = batchFactory(metadataBackend, redisUtils.getPool());

    before(function (done) {
        batch.start();
        batch.on('ready', done);
    });

    after(function (done) {
        batch.stop();
        redisUtils.clean('batch:*', done);
    });

    var doneJob = {};

    it('Step 1, should create a job', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 201
        }, function (err, res) {
            doneJob = JSON.parse(res.body);
            done();
        });
    });

    it('Step 2, job should be done', function (done) {
        var interval = setInterval(function () {
            assert.response(server, {
                url: '/api/v2/sql/job/' + doneJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'GET'
            }, {
                status: 200
            }, function (err, res) {
                var job = JSON.parse(res.body);
                if (job.status === "done") {
                    clearInterval(interval);
                    done();
                } else if (job.status === "failed" || job.status === "cancelled") {
                    clearInterval(interval);
                    done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                } else {
                    console.log('Job ' + job.job_id + ' is ' + job.status + ', expecting to be done');
                }
            });
        }, 50);
    });

    it('Step 3, cancel a done job should give an error', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job/' + doneJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 400
        }, function(err, res) {
            var errors = JSON.parse(res.body);
            assert.equal(errors.error[0], "Cannot set status from done to cancelled");
            done();
        });
    });
});
