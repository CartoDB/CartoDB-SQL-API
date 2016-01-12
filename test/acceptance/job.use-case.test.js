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

describe('job and batch together', function() {

    var batch = batchFactory(metadataBackend);

    before(function () {
        batch.start();
    });

    after(function () {
        batch.stop();
    });

    describe('Use case 1: cancel and modify a done job', function () {
        var doneJob = {};

        it('Step 1, should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/job?api_key=1234',
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

        it('Step 2, job should be done', function (done){
            setTimeout(function () {
                assert.response(app, {
                    url: '/api/v2/job/' + doneJob.job_id + '?api_key=1234',
                    headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                    method: 'GET'
                }, {
                    status: 200
                }, function(res) {
                    var jobDone = JSON.parse(res.body);
                    assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
                    assert.equal(jobDone.status, "done");
                    done();
                });

            }, 200);
        });

        it('Step 3, cancel a done job should give an error', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + doneJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'DELETE'
            }, {
                status: 400
            }, function(res) {
                var errors = JSON.parse(res.body);
                assert.equal(errors.error[0], "Job is done, cancel is not allowed");
                done();
            });
        });

        it('Step 4, modify a done job should give an error', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + doneJob.job_id + '?api_key=1234',
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

    describe('Use case 2: cancel a running job', function () {
        var runningJob = {};
        var cancelledJob = {};

        it('Step 1, should create a new job', function (done){
            assert.response(app, {
                url: '/api/v2/job?api_key=1234',
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

        it('Step 2, job should be running', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + runningJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'GET'
            }, {
                status: 200
            }, function(res) {
                var jobGot = JSON.parse(res.body);
                assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
                assert.equal(jobGot.status, "running");
                done();
            });
        });

        it('Step 3, job should be cancelled', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + runningJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'DELETE'
            }, {
                status: 200
            }, function(res) {
                cancelledJob = JSON.parse(res.body);
                assert.equal(cancelledJob.status, "cancelled");
                done();
            });
        });

        it('Step 4, cancel a cancelled should give an error', function (done) {
            assert.response(app, {
                url: '/api/v2/job/' + cancelledJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'DELETE'
            }, {
                status: 400
            }, function(res) {
                var errors = JSON.parse(res.body);
                assert.equal(errors.error[0], "Job is cancelled, cancel is not allowed");
                done();
            });
        });

        it('Step 5, modify a cancelled job should give an error', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + cancelledJob.job_id + '?api_key=1234',
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


    describe('Use case 3: cancel a pending job', function () {
        var runningJob = {};
        var pendingJob = {};

        it('Step 1, should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/job?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'POST',
                data: querystring.stringify({
                    query: "SELECT * FROM untitle_table_4; select pg_sleep(3)"
                })
            }, {
                status: 201
            }, function (res) {
                runningJob = JSON.parse(res.body);
                done();
            });
        });

        it('Step 2, should create a another job', function (done) {
            assert.response(app, {
                url: '/api/v2/job?api_key=1234',
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
            assert.response(app, {
                url: '/api/v2/job/' + pendingJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'GET'
            }, {
                status: 200
            }, function(res) {
                var jobGot = JSON.parse(res.body);
                assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
                assert.equal(jobGot.status, "pending");
                done();
            });
        });

        it('Step 4, cancel a job should be cancelled', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + pendingJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'DELETE'
            }, {
                status: 200
            }, function(res) {
                var jobGot = JSON.parse(res.body);
                assert.equal(jobGot.job_id, pendingJob.job_id);
                assert.equal(jobGot.status, "cancelled");
                done();
            });
        });

        it('Step 5, running job should be cancelled', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + runningJob.job_id + '?api_key=1234',
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

    describe('Use case 4: modify a pending job', function () {
        var runningJob = {};
        var pendingJob = {};

        it('Step 1, should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/job?api_key=1234',
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
                url: '/api/v2/job?api_key=1234',
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
            assert.response(app, {
                url: '/api/v2/job/' + pendingJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'GET'
            }, {
                status: 200
            }, function(res) {
                var jobGot = JSON.parse(res.body);
                assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
                assert.equal(jobGot.status, "pending");
                done();
            });
        });

        it('Step 4, job should be modified', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + pendingJob.job_id + '?api_key=1234',
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
                url: '/api/v2/job/' + runningJob.job_id + '?api_key=1234',
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

    describe('Use case 5: modify a running job', function () {
        var runningJob = {};

        it('Step 1, should create job', function (done) {
            assert.response(app, {
                url: '/api/v2/job?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'POST',
                data: querystring.stringify({
                    query: "SELECT * FROM untitle_table_4; select pg_sleep(2)"
                })
            }, {
                status: 201
            }, function (res) {
                runningJob = JSON.parse(res.body);
                done();
            });
        });

        it('Step 2, job should be running', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + runningJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'GET'
            }, {
                status: 200
            }, function(res) {
                var jobGot = JSON.parse(res.body);
                assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
                assert.equal(jobGot.status, "running");
                done();
            });
        });

        it('Step 3, modify job should give an error', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + runningJob.job_id + '?api_key=1234',
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

        it('Step 4, job should be cancelled', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + runningJob.job_id + '?api_key=1234',
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
                url: '/api/v2/job/' + runningJob.job_id + '?api_key=1234',
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

    describe('Use case 6: modify a done job', function () {
        var doneJob = {};

        it('Step 1, should create job', function (done) {
            assert.response(app, {
                url: '/api/v2/job?api_key=1234',
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

        it('Step 2, job should be done', function (done){
            setTimeout(function () {
                assert.response(app, {
                    url: '/api/v2/job/' + doneJob.job_id + '?api_key=1234',
                    headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                    method: 'GET'
                }, {
                    status: 200
                }, function(res) {
                    var jobGot = JSON.parse(res.body);
                    assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
                    assert.equal(jobGot.status, "done");
                    done();
                });
            }, 200);
        });

        it('Step 3, modify job should give an error', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + doneJob.job_id + '?api_key=1234',
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

        it('Step 5, modify a cancelled job should give an error', function (done){
            assert.response(app, {
                url: '/api/v2/job/' + doneJob.job_id + '?api_key=1234',
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
});
