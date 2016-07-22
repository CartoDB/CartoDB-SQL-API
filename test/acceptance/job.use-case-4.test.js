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
var redisConfig = {
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
};
var metadataBackend = require('cartodb-redis')(redisConfig);
var batchFactory = require('../../batch');

describe('Use case 4: modify a pending job', function() {
    var batch = batchFactory(metadataBackend, redisConfig);

    before(function (done) {
        batch.start();
        batch.on('ready', done);
    });

    after(function (done) {
        batch.stop();
        metadataBackend.redisCmd(5, 'KEYS', [ 'batch:*'], function (err, keys) {
            if (err) { return done(err); }
            metadataBackend.redisCmd(5, 'DEL', keys, done);
        });
    });

    var runningJob = {};
    var pendingJob = {};

    it('Step 1, should create a job', function (done) {
        assert.response(app, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4; select pg_sleep(3)"
            })
        }, {
            status: 201
        }, function(res) {
            runningJob = JSON.parse(res.body);
            done();
        });
    });

    it('Step 2, should create another job', function (done) {
        assert.response(app, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 201
        }, function(res) {
            pendingJob = JSON.parse(res.body);
            done();
        });
    });

    it('Step 3, job should be pending', function (done){
        var interval = setInterval(function () {
            assert.response(app, {
                url: '/api/v2/sql/job/' + pendingJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'GET'
            }, {
                status: 200
            }, function(res) {
                var job = JSON.parse(res.body);
                if (job.status === "pending") {
                    clearInterval(interval);
                    done();
                } else {
                    clearInterval(interval);
                    done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be pending'));
                }
            });
        }, 50);
    });

    it('Step 4, job should be modified', function (done){
        assert.response(app, {
            url: '/api/v2/sql/job/' + pendingJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PUT',
            data: querystring.stringify({
                query: "SELECT cartodb_id FROM untitle_table_4"
            })
        }, {
            status: 200
        }, function(res) {
            var jobGot = JSON.parse(res.body);
            assert.equal(jobGot.job_id, pendingJob.job_id);
            assert.equal(jobGot.query, "SELECT cartodb_id FROM untitle_table_4");
            done();
        });
    });

    it('Step 5, running job should be cancelled', function (done){
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
});
