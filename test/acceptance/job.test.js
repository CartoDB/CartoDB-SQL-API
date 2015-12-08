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

describe('job.test', function() {

    it('GET /api/v2/job', function (done){
        assert.response(app, {
            url: '/api/v2/job',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {
            status: 400
        }, function(res) {
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.deepEqual(res.headers['content-disposition'], 'inline');
            assert.deepEqual(JSON.parse(res.body), {"error":["You must indicate a sql query"]});
            done();
        });
    });

    it('GET /api/v2/job with SQL parameter on SELECT no database param,just id using headers', function(done){
        assert.response(app, {
            url: '/api/v2/job?'  + querystring.stringify({ q: "SELECT * FROM untitle_table_4" }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {
        }, function (res) {
            assert.equal(res.statusCode, 200, res.body);
            done();
        });
    });

    it('GET job status via /api/v2/sql with SQL parameter. no database param, just id using headers. Authenticated.',
    function(done){
        assert.response(app, {
            url: '/api/v2/job?' + querystring.stringify({ q: "SELECT * FROM untitle_table_4" }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {
        }, function (res) {
            var job_id = JSON.parse(res.body).rows[0].job_id;
            assert.equal(res.statusCode, 200, res.body);

            assert.response(app, {
                url: '/api/v2/sql?&api_key=1234&' + querystring.stringify({
                    q: 'SELECT status FROM cdb_jobs WHERE job_id=\'' + job_id + '\''
                }),
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'GET'
            },{ }, function(res) {
                assert.equal(res.statusCode, 200, res.body);
                assert.equal(JSON.parse(res.body).rows[0].status, 'pending');
                done();
            });
        });
    });

    it('UPDATE job query via /api/v2/sql with SQL parameter. no database param, just id using headers. Authenticated.',
    function (done) {
        assert.response(app, {
            url: '/api/v2/job?'  + querystring.stringify({ q: "SELECT * FROM untitle_table_4" }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {
        }, function (res) {
            assert.equal(res.statusCode, 200, res.body);
            var job_id = JSON.parse(res.body).rows[0].job_id;
            var updated_query = 'SELECT cartodb_id FROM untitle_table_4';

            assert.response(app, {
                url: '/api/v2/sql??api_key=1234&' + querystring.stringify({
                    q: "UPDATE cdb_jobs SET query='" + updated_query + "' WHERE job_id = '" + job_id +
                        "' RETURNING job_id, query"
                }),
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'GET'
            },{ }, function(res) {
                assert.equal(res.statusCode, 200, res.body);
                assert.equal(updated_query, JSON.parse(res.body).rows[0].query);
                done();
            });
        });
    });

    it('DELETE job query via /api/v2/sql with SQL parameter. no database param, just id using headers. Authenticated.',
    function (done) {
        assert.response(app, {
            url: '/api/v2/job?' + querystring.stringify({ q: "SELECT * FROM untitle_table_4" }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {
        }, function (res) {
            assert.equal(res.statusCode, 200, res.body);
            var job_id = JSON.parse(res.body).rows[0].job_id;
            var deleted_query = 'SELECT * FROM untitle_table_4';

            assert.response(app, {
                url: '/api/v2/sql??api_key=1234&' + querystring.stringify({
                    q: "DELETE FROM cdb_jobs WHERE job_id = '" + job_id +
                        "' RETURNING job_id, query"
                }),
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'GET'
            },{ }, function(res) {
                assert.equal(res.statusCode, 200, res.body);
                assert.equal(deleted_query, JSON.parse(res.body).rows[0].query);
                assert.equal(job_id, JSON.parse(res.body).rows[0].job_id);
                done();
            });
        });
    });
});
