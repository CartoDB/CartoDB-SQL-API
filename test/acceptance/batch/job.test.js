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

describe('job module', function() {
    var job = {};

    after(function (done) {
        redisUtils.clean('batch:*', done);
    });

    it('POST /api/v2/sql/job should respond with 200 and the created job', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 201
        }, function(err, res) {
            job = JSON.parse(res.body);
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.ok(job.job_id);
            assert.equal(job.query, "SELECT * FROM untitle_table_4");
            assert.equal(job.user, "vizzuality");
            done();
        });
    });

    it('POST /api/v2/sql/job without query should respond with 400 and the corresponding message of error',
    function (done){
        assert.response(server, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({})
        }, {
            status: 400
        }, function(err, res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'You must indicate a valid SQL' ] });
            done();
        });
    });

    it('POST /api/v2/sql/job with bad query param should respond with 400 and message of error', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                q: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 400
        }, function(err, res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'You must indicate a valid SQL' ] });
            done();
        });
    });

    it('POST /api/v2/sql/job with wrong api key should respond with 403 permission denied', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job?api_key=wrong',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 403
        }, function(err, res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'permission denied' ] });
            done();
        });
    });

    it('POST /api/v2/sql/job with wrong host header should respond with 404 not found', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job?api_key=wrong',
            headers: { 'host': 'wrong-host.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 404
        }, function(err, res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, {
                error: [
                    'Sorry, we can\'t find CARTO user \'wrong-host\'. ' +
                    'Please check that you have entered the correct domain.'
                ]
            });
            done();
        });
    });

    it('GET /api/v2/sql/job/:job_id should respond with 200 and the requested job', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job/' + job.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 200
        }, function(err, res) {
            var jobGot = JSON.parse(res.body);
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.equal(jobGot.query, "SELECT * FROM untitle_table_4");
            assert.equal(jobGot.user, "vizzuality");
            done();
        });
    });

    it('GET /api/v2/sql/job/:job_id with wrong api key should respond with 403 permission denied', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job/' + job.job_id + '?api_key=wrong',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 403
        }, function(err, res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'permission denied' ] });
            done();
        });
    });

    it('GET /api/v2/sql/job/:jobId with wrong jobId header respond with 400 and an error', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job/irrelevantJob?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 400
        }, function(err, res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error , {
                error: ['Job with id irrelevantJob not found']
            });
            done();
        });
    });

    it('DELETE /api/v2/sql/job/:job_id should respond with 200 and the requested job', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job/' + job.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 200
        }, function(err, res) {
            var jobCancelled = JSON.parse(res.body);
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.equal(jobCancelled.job_id, job.job_id);
            assert.equal(jobCancelled.query, "SELECT * FROM untitle_table_4");
            assert.equal(jobCancelled.user, "vizzuality");
            assert.equal(jobCancelled.status, "cancelled");
            done();
        });
    });

    it('DELETE /api/v2/sql/job/:job_id with wrong api key should respond with 403 permission denied', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job/' + job.job_id + '?api_key=wrong',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 403
        }, function(err, res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'permission denied' ] });
            done();
        });
    });

    it('DELETE /api/v2/sql/job/ with wrong host header respond with 404 not found', function (done){
        assert.response(server, {
            url: '/api/v2/sql/job/' + job.job_id + '?api_key=1234',
            headers: { 'host': 'wrong-host.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 404
        }, function(err, res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error , {
                error: [
                    'Sorry, we can\'t find CARTO user \'wrong-host\'. ' +
                    'Please check that you have entered the correct domain.'
                ]
            });
            done();
        });
    });
});
