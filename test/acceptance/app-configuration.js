'use strict';

require('../helper');

var server = require('../../app/server')();
var assert = require('../support/assert');

const accessControlHeaders = [
    'X-Requested-With',
    'X-Prototype-Version',
    'X-CSRF-Token',
    'Authorization'
].join(', ');

const exposedHeaders = [
    'Carto-Rate-Limit-Limit',
    'Carto-Rate-Limit-Remaining',
    'Carto-Rate-Limit-Reset',
    'Retry-After',
    'X-Cache'
].join(', ');

describe('app-configuration', function() {

    var RESPONSE_OK = {
        statusCode: 200
    };

    var expected_cache_control = 'no-cache,max-age=31536000,must-revalidate,public';
    var expected_cache_control_persist = 'public,max-age=31536000';

    it('GET /api/v1/version', function(done){
        assert.response(server, {
            url: '/api/v1/version',
            method: 'GET'
        }, RESPONSE_OK, function(err, res) {
            var parsed = JSON.parse(res.body);
            var sqlapi_version = require(__dirname + '/../../package.json').version;
            assert.ok(parsed.hasOwnProperty('cartodb_sql_api'), "No 'cartodb_sql_api' version in " + parsed);
            assert.equal(parsed.cartodb_sql_api, sqlapi_version);
            done();
        });
    });

    it('GET /api/v1/sql', function(done){
        assert.response(server, {
            url: '/api/v1/sql',
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        },{
            status: 400
        }, function(err, res) {
            assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.deepEqual(res.headers['content-disposition'], 'inline');
            assert.deepEqual(JSON.parse(res.body), {"error":["You must indicate a sql query"]});
            done();
        });
    });

    // Test base_url setting
    it('GET /api/whatever/sql', function(done){
        assert.response(server, {
            url: '/api/whatever/sql?q=SELECT%201',
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        }, RESPONSE_OK, done);
    });

    // Test CORS headers with GET
    it('GET /api/whatever/sql', function(done){
        assert.response(server, {
            url: '/api/whatever/sql?q=SELECT%201',
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        }, RESPONSE_OK, function(err, res) {
            assert.equal(
                res.headers['access-control-allow-headers'],
                accessControlHeaders
            );
            assert.equal(
                res.headers['access-control-expose-headers'],
                exposedHeaders
            );
            assert.equal(res.headers['access-control-allow-origin'], '*');
            done();
        });
    });

    // Test that OPTIONS does not run queries
    it('OPTIONS /api/x/sql', function(done){
        assert.response(server, {
            url: '/api/x/sql?q=syntax%20error',
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'OPTIONS'
        }, RESPONSE_OK, function(err, res) {
            assert.equal(res.body, '');
            assert.equal(
                res.headers['access-control-allow-headers'],
                accessControlHeaders
            );
            assert.equal(
                res.headers['access-control-expose-headers'],
                exposedHeaders
            );
            assert.equal(res.headers['access-control-allow-origin'], '*');
            done();
        });
    });


    it('cache_policy=persist', function(done){
        assert.response(server, {
            url: '/api/v1/sql?q=' +
                'SELECT%20*%20FROM%20untitle_table_4&database=cartodb_test_user_1_db&cache_policy=persist',
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        }, RESPONSE_OK, function(err, res) {
            // Check cache headers
            assert.ok(res.headers.hasOwnProperty('x-cache-channel'));
            // See https://github.com/CartoDB/CartoDB-SQL-API/issues/105
            assert.equal(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:public.untitle_table_4');
            assert.equal(res.headers['cache-control'], expected_cache_control_persist);
            done();
        });
    });

    // See https://github.com/CartoDB/CartoDB-SQL-API/issues/121
    it('SELECT from user-specific database', function(done){
        var backupDBHost = global.settings.db_host;
        global.settings.db_host = '6.6.6.6';
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT+2+as+n',
            headers: {host: 'cartodb250user.cartodb.com'},
            method: 'GET'
        }, RESPONSE_OK, function(err, res) {
            global.settings.db_host = backupDBHost;
            try {
                var parsed = JSON.parse(res.body);
                assert.equal(parsed.rows.length, 1);
                assert.equal(parsed.rows[0].n, 2);
            } catch (e) {
                return done(e);
            }
            done();
        });
    });

    // See https://github.com/CartoDB/CartoDB-SQL-API/issues/120
    it('SELECT with user-specific password', function(done){
        var backupDBUserPass = global.settings.db_user_pass;
        global.settings.db_user_pass = '<%= user_password %>';
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT+2+as+n&api_key=1234',
            headers: {host: 'cartodb250user.cartodb.com'},
            method: 'GET'
        }, RESPONSE_OK, function(err, res) {
            global.settings.db_user_pass = backupDBUserPass;
            try {
            assert.equal(res.statusCode, 200, res.statusCode + ": " + res.body);
            var parsed = JSON.parse(res.body);
            assert.equal(parsed.rows.length, 1);
            assert.equal(parsed.rows[0].n, 2);
            } catch (e) {
            return done(e);
            }
            return done();
        });
    });

    /**
     * CORS
     */
    it('GET /api/v1/sql with SQL parameter on SELECT only should return CORS headers ', function(done){
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&database=cartodb_test_user_1_db',
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        }, RESPONSE_OK, function(err, res) {
            // Check cache headers
            assert.equal(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:public.untitle_table_4');
            assert.equal(res.headers['cache-control'], expected_cache_control);
            assert.equal(res.headers['access-control-allow-origin'], '*');
            assert.equal(
                res.headers['access-control-allow-headers'],
                accessControlHeaders
            );
            assert.equal(
                res.headers['access-control-expose-headers'],
                exposedHeaders
            );
            done();
        });
    });

});
