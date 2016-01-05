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

    it('POST /api/v2/job should respond with 200 and the created job', function (done){
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

    it('POST /api/v2/job without query should respond with 400 and the corresponding message of error', function (done){
        assert.response(app, {
            url: '/api/v2/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({})
        }, {
            status: 400
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'You must indicate a sql query' ] });
            done();
        });
    });

    it('POST /api/v2/job with bad query param should respond with 400 and message of error', function (done){
        assert.response(app, {
            url: '/api/v2/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                q: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 400
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'You must indicate a sql query' ] });
            done();
        });
    });

    it('POST /api/v2/job with wrong api key should respond with 401 permission denied', function (done){
        assert.response(app, {
            url: '/api/v2/job?api_key=wrong',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 401
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'permission denied' ] });
            done();
        });
    });

    it('POST /api/v2/job with wrong host header should respond with 404 not found', function (done){
        assert.response(app, {
            url: '/api/v2/job?api_key=wrong',
            headers: { 'host': 'wrong-host.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 404
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, {
                error: [
                    'Sorry, we can\'t find CartoDB user \'wrong-host\'. ' +
                    'Please check that you have entered the correct domain.'
                ]
            });
            done();
        });
    });

    it('GET /api/v2/job/:job_id should respond with 200 and the requested job', function (done){
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

    it('GET /api/v2/job/:job_id with wrong api key should respond with 401 permission denied', function (done){
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=wrong',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 401
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'permission denied' ] });
            done();
        });
    });

    it('GET /api/v2/job/ with wrong host header respond with 404 not found', function (done){
        assert.response(app, {
            url: '/api/v2/job?api_key=1234',
            headers: { 'host': 'wrong-host.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 404
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error , {
                error: [
                    'Sorry, we can\'t find CartoDB user \'wrong-host\'. ' +
                    'Please check that you have entered the correct domain.'
                ]
            });
            done();
        });
    });

    it('PUT /api/v2/job/:job_id should respond 200 and the updated job', function (done) {
        var query ="SELECT cartodb_id FROM untitle_table_4";
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PUT',
            data: querystring.stringify({
                query: query
            })
        }, {
            status: 200
        }, function(res) {
            job = JSON.parse(res.body);
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.ok(job.job_id);
            assert.equal(job.query, query);
            assert.equal(job.user, "vizzuality");
            done();
        });
    });

    it('PUT /api/v2/job/:job_id without query should respond with 400 and message of error', function (done){
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PUT',
            data: querystring.stringify({})
        }, {
            status: 400
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'You must indicate a sql query' ] });
            done();
        });
    });

    it('PUT /api/v2/job with bad query param should respond with 400 and message of error', function (done){
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PUT',
            data: querystring.stringify({
                q: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 400
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'You must indicate a sql query' ] });
            done();
        });
    });

    it('PUT /api/v2/job/:job_id with wrong api key should respond with 401 permission denied', function (done) {
        var query ="SELECT cartodb_id FROM untitle_table_4";
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=wrong',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PUT',
            data: querystring.stringify({
                query: query
            })
        }, {
            status: 401
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'permission denied' ] });
            done();
        });
    });

    it('PUT /api/v2/job with wrong host header should respond with 404 not found', function (done){
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=wrong',
            headers: { 'host': 'wrong-host.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PUT',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 404
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error , {
                error: [
                    'Sorry, we can\'t find CartoDB user \'wrong-host\'. ' +
                    'Please check that you have entered the correct domain.'
                ]
            });
            done();
        });
    });

    it('PATCH /api/v2/job/:job_id  should respond 200 and the updated job', function (done) {
        var query ="SELECT * FROM untitle_table_4";
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PATCH',
            data: querystring.stringify({
                query: query
            })
        }, {
            status: 200
        }, function(res) {
            job = JSON.parse(res.body);
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.ok(job.job_id);
            assert.equal(job.query, query);
            assert.equal(job.user, "vizzuality");
            done();
        });
    });

    it('PATCH /api/v2/job/:job_id without query should respond with 400 and message of error', function (done){
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PATCH',
            data: querystring.stringify({})
        }, {
            status: 400
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'You must indicate a sql query' ] });
            done();
        });
    });

    it('PATCH /api/v2/job with bad query param should respond with 400 and message of error', function (done){
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PATCH',
            data: querystring.stringify({
                q: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 400
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'You must indicate a sql query' ] });
            done();
        });
    });

    it('PATCH /api/v2/job/:job_id with wrong api key should respond with 401 permission denied', function (done) {
        var query ="SELECT * FROM untitle_table_4";
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=wrong',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PATCH',
            data: querystring.stringify({
                query: query
            })
        }, {
            status: 401
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'permission denied' ] });
            done();
        });
    });

    it('PATCH /api/v2/job with wrong host header should respond with 404 not found', function (done){
        assert.response(app, {
            url: '/api/v2/job/' + job.job_id + '?api_key=wrong',
            headers: { 'host': 'wrong-host.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PATCH',
            data: querystring.stringify({
                query: "SELECT * FROM untitle_table_4"
            })
        }, {
            status: 404
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error , {
                error: [
                    'Sorry, we can\'t find CartoDB user \'wrong-host\'. ' +
                    'Please check that you have entered the correct domain.'
                ]
            });
            done();
        });
    });

    it('GET /api/v2/job/ should respond with 200 and a job\'s list', function (done){
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

    it('GET /api/v2/job/ with wrong api key should respond with 401 permission denied', function (done){
        assert.response(app, {
            url: '/api/v2/job?api_key=wrong',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 401
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'permission denied' ] });
            done();
        });
    });

    it('GET /api/v2/job/ without host header respond with 404 not found', function (done){
        assert.response(app, {
            url: '/api/v2/job?api_key=1234',
            headers: { 'host': 'wrong-host.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 404
        }, function(res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error , {
                error: [
                    'Sorry, we can\'t find CartoDB user \'wrong-host\'. ' +
                    'Please check that you have entered the correct domain.'
                ]
            });
            done();
        });
    });
});
