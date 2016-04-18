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
var fs = require('fs');
var queryTooLong = fs.readFileSync('./test/fixtures/queryTooLong.sql','utf-8');
var queryMaxSize = queryTooLong.slice(1);

describe('job query limit', function() {

    after(function (done) {
        // batch services is not activate, so we need empty the queue to avoid unexpected
        // behaviour in further tests
        metadataBackend.redisCmd(5, 'DEL', [ 'batch:queues:localhost' ], done);
    });

    it('POST /api/v2/sql/job with a invalid query size  should respond with 400 query too long', function (done){

        assert.response(app, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: queryTooLong
            })
        }, {
            status: 400
        }, function (res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'Query is too long (4097). Max size allowed is 4096 (4kb)' ] });
            done();
        });
    });

    it('PUT /api/v2/sql/job with a invalid query size  should respond with 400 query too long', function (done){

        assert.response(app, {
            url: '/api/v2/sql/job/wadus?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'PUT',
            data: querystring.stringify({
                query: queryTooLong
            })
        }, {
            status: 400
        }, function (res) {
            var error = JSON.parse(res.body);
            assert.deepEqual(error, { error: [ 'Query is too long (4097). Max size allowed is 4096 (4kb)' ] });
            done();
        });
    });

    it('POST /api/v2/sql/job with a valid query size should respond with 201 created', function (done){

        assert.response(app, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: queryMaxSize
            })
        }, {
            status: 201
        }, function (res) {
            var job = JSON.parse(res.body);
            assert.ok(job.job_id);
            done();
        });
    });

});
