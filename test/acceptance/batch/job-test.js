'use strict';

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

var server = require('../../../lib/server')();
var assert = require('../../support/assert');
var redisUtils = require('../../support/redis-utils');
var querystring = require('querystring');

describe('job module', function () {
    var job = {};

    after(function (done) {
        redisUtils.clean(global.settings.batch_db, 'batch:*', done);
    });

    it('POST /api/v2/sql/job should respond with 200 and the created job', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: 'SELECT * FROM untitle_table_4'
            })
        }, {
            status: 201
        }, function (err, res) {
            assert.ifError(err);
            job = JSON.parse(res.body);
            assert.deepStrictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.ok(job.job_id);
            assert.strictEqual(job.query, 'SELECT * FROM untitle_table_4');
            assert.strictEqual(job.user, 'vizzuality');
            done();
        });
    });

    it('POST /api/v2/sql/job without query should respond with 400 and the corresponding message of error',
        function (done) {
            assert.response(server, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'POST',
                data: querystring.stringify({})
            }, {
                status: 400
            }, function (err, res) {
                assert.ifError(err);
                var error = JSON.parse(res.body);
                assert.deepStrictEqual(error, { error: ['You must indicate a valid SQL'] });
                done();
            });
        });

    it('POST /api/v2/sql/job with bad query param should respond with 400 and message of error', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                q: 'SELECT * FROM untitle_table_4'
            })
        }, {
            status: 400
        }, function (err, res) {
            assert.ifError(err);
            var error = JSON.parse(res.body);
            assert.deepStrictEqual(error, { error: ['You must indicate a valid SQL'] });
            done();
        });
    });

    it('POST /api/v2/sql/job with wrong api key should respond with 401 permission denied', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job?api_key=wrong',
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: 'SELECT * FROM untitle_table_4'
            })
        }, {
            status: 401
        }, function (err, res) {
            assert.ifError(err);
            var error = JSON.parse(res.body);
            assert.deepStrictEqual(error, { error: ['Unauthorized'] });
            done();
        });
    });

    it('POST /api/v2/sql/job with wrong host header should respond with 404 not found', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job?api_key=wrong',
            headers: { host: 'wrong-host.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: 'SELECT * FROM untitle_table_4'
            })
        }, {
            status: 404
        }, function (err, res) {
            assert.ifError(err);
            var error = JSON.parse(res.body);
            assert.deepStrictEqual(error, {
                error: [
                    'Sorry, we can\'t find CARTO user \'wrong-host\'. ' +
                    'Please check that you have entered the correct domain.'
                ]
            });
            done();
        });
    });

    it('GET /api/v2/sql/job/:job_id should respond with 200 and the requested job', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job/' + job.job_id + '?api_key=1234',
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 200
        }, function (err, res) {
            assert.ifError(err);
            var jobGot = JSON.parse(res.body);
            assert.deepStrictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.strictEqual(jobGot.query, 'SELECT * FROM untitle_table_4');
            assert.strictEqual(jobGot.user, 'vizzuality');
            done();
        });
    });

    it('GET /api/v2/sql/job/:job_id with wrong api key should respond with 401 permission denied', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job/' + job.job_id + '?api_key=wrong',
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 401
        }, function (err, res) {
            assert.ifError(err);
            var error = JSON.parse(res.body);
            assert.deepStrictEqual(error, { error: ['Unauthorized'] });
            done();
        });
    });

    it('GET /api/v2/sql/job/:jobId with wrong jobId header respond with 400 and an error', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job/irrelevantJob?api_key=1234',
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 400
        }, function (err, res) {
            assert.ifError(err);
            var error = JSON.parse(res.body);
            assert.deepStrictEqual(error, {
                error: ['Job with id irrelevantJob not found']
            });
            done();
        });
    });

    it('DELETE /api/v2/sql/job/:job_id should respond with 200 and the requested job', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job/' + job.job_id + '?api_key=1234',
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 200
        }, function (err, res) {
            assert.ifError(err);
            var jobCancelled = JSON.parse(res.body);
            assert.deepStrictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.strictEqual(jobCancelled.job_id, job.job_id);
            assert.strictEqual(jobCancelled.query, 'SELECT * FROM untitle_table_4');
            assert.strictEqual(jobCancelled.user, 'vizzuality');
            assert.strictEqual(jobCancelled.status, 'cancelled');
            done();
        });
    });

    it('DELETE /api/v2/sql/job/:job_id with wrong api key should respond with 401 permission denied', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job/' + job.job_id + '?api_key=wrong',
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 401
        }, function (err, res) {
            assert.ifError(err);
            var error = JSON.parse(res.body);
            assert.deepStrictEqual(error, { error: ['Unauthorized'] });
            done();
        });
    });

    it('DELETE /api/v2/sql/job/ with wrong host header respond with 404 not found', function (done) {
        assert.response(server, {
            url: '/api/v2/sql/job/' + job.job_id + '?api_key=1234',
            headers: { host: 'wrong-host.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 404
        }, function (err, res) {
            assert.ifError(err);
            var error = JSON.parse(res.body);
            assert.deepStrictEqual(error, {
                error: [
                    'Sorry, we can\'t find CARTO user \'wrong-host\'. ' +
                    'Please check that you have entered the correct domain.'
                ]
            });
            done();
        });
    });
});
