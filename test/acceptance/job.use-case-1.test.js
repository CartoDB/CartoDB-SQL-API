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
var redisUtils = require('../support/redis_utils');
var querystring = require('querystring');
var redisConfig = {
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
};
var metadataBackend = require('cartodb-redis')(redisConfig);
var batchFactory = require('../../batch');

describe('Use case 1: cancel and modify a done job', function () {
    var batch = batchFactory(metadataBackend, redisConfig);

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
        assert.response(app, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 201
        }, function (res) {
            doneJob = JSON.parse(res.body);
            done();
        });
    });

    it('Step 2, job should be done', function (done) {
        var interval = setInterval(function () {
            assert.response(app, {
                url: '/api/v2/sql/job/' + doneJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'GET'
            }, {
                status: 200
            }, function (res) {
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
        assert.response(app, {
            url: '/api/v2/sql/job/' + doneJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 400
        }, function(res) {
            var errors = JSON.parse(res.body);
            assert.equal(errors.error[0], "Cannot set status from done to cancelled");
            done();
        });
    });
});
