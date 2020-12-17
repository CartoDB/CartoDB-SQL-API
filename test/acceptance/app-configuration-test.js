'use strict';

require('../helper');

var server = require('../../lib/server')();
var assert = require('../support/assert');

const accessControlHeaders = [
    '*'
].join(', ');

const exposedHeaders = [
    '*'
].join(', ');

describe('app-configuration', function () {
    var RESPONSE_OK = {
        statusCode: 200
    };

    var expectedCacheControl = 'no-cache,max-age=31536000,must-revalidate,public';
    var expectedCacheControlPersist = 'public,max-age=31536000';

    it('GET /api/v1/version', function (done) {
        assert.response(server, {
            url: '/api/v1/version',
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            var parsed = JSON.parse(res.body);
            var sqlapiversion = require('../../package.json').version;
            assert.ok(Object.prototype.hasOwnProperty.call(parsed, 'cartodb_sql_api'), "No 'cartodb_sql_api' version in " + parsed);
            assert.strictEqual(parsed.cartodb_sql_api, sqlapiversion);
            done();
        });
    });

    it('GET /api/v1/sql', function (done) {
        assert.response(server, {
            url: '/api/v1/sql',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {
            status: 400
        }, function (err, res) {
            assert.ifError(err);
            assert.deepStrictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.deepStrictEqual(res.headers['content-disposition'], 'inline');
            assert.deepStrictEqual(JSON.parse(res.body), { error: ['You must indicate a sql query'] });
            done();
        });
    });

    // Test base_url setting
    it('GET /api/whatever/sql', function (done) {
        assert.response(server, {
            url: '/api/whatever/sql?q=SELECT%201',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, RESPONSE_OK, done);
    });

    // Test CORS headers with GET
    it('GET /api/whatever/sql', function (done) {
        assert.response(server, {
            url: '/api/whatever/sql?q=SELECT%201',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(
                res.headers['access-control-allow-headers'],
                accessControlHeaders
            );
            assert.strictEqual(
                res.headers['access-control-expose-headers'],
                exposedHeaders
            );
            assert.strictEqual(res.headers['access-control-allow-origin'], '*');
            done();
        });
    });

    // Test that OPTIONS does not run queries
    it('OPTIONS /api/x/sql', function (done) {
        assert.response(server, {
            url: '/api/x/sql?q=syntax%20error',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'OPTIONS'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.body, '');
            assert.strictEqual(
                res.headers['access-control-allow-headers'],
                accessControlHeaders
            );
            assert.strictEqual(
                res.headers['access-control-expose-headers'],
                exposedHeaders
            );
            assert.strictEqual(res.headers['access-control-allow-origin'], '*');
            done();
        });
    });

    it('cache_policy=persist', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=' +
                'SELECT%20*%20FROM%20untitle_table_4&database=cartodb_test_user_1_db&cache_policy=persist',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            // Check cache headers
            assert.ok(Object.prototype.hasOwnProperty.call(res.headers, 'x-cache-channel'));
            // See https://github.com/CartoDB/CartoDB-SQL-API/issues/105
            assert.strictEqual(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:public.untitle_table_4');
            assert.strictEqual(res.headers['cache-control'], expectedCacheControlPersist);
            done();
        });
    });

    // See https://github.com/CartoDB/CartoDB-SQL-API/issues/121
    it('SELECT from user-specific database', function (done) {
        var backupDBHost = global.settings.db_host;
        global.settings.db_host = '6.6.6.6';
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT+2+as+n',
            headers: { host: 'cartodb250user.cartodb.com' },
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            global.settings.db_host = backupDBHost;
            try {
                var parsed = JSON.parse(res.body);
                assert.strictEqual(parsed.rows.length, 1);
                assert.strictEqual(parsed.rows[0].n, 2);
            } catch (e) {
                return done(e);
            }
            done();
        });
    });

    // See https://github.com/CartoDB/CartoDB-SQL-API/issues/120
    it('SELECT with user-specific password', function (done) {
        var backupDBUserPass = global.settings.db_user_pass;
        global.settings.db_user_pass = '<%= user_password %>';
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT+2+as+n&api_key=1234',
            headers: { host: 'cartodb250user.cartodb.com' },
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            global.settings.db_user_pass = backupDBUserPass;
            try {
                assert.strictEqual(res.statusCode, 200, res.statusCode + ': ' + res.body);
                var parsed = JSON.parse(res.body);
                assert.strictEqual(parsed.rows.length, 1);
                assert.strictEqual(parsed.rows[0].n, 2);
            } catch (e) {
                return done(e);
            }
            return done();
        });
    });

    /**
     * CORS
     */
    it('GET /api/v1/sql with SQL parameter on SELECT only should return CORS headers ', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&database=cartodb_test_user_1_db',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            // Check cache headers
            assert.strictEqual(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:public.untitle_table_4');
            assert.strictEqual(res.headers['cache-control'], expectedCacheControl);
            assert.strictEqual(res.headers['access-control-allow-origin'], '*');
            assert.strictEqual(
                res.headers['access-control-allow-headers'],
                accessControlHeaders
            );
            assert.strictEqual(
                res.headers['access-control-expose-headers'],
                exposedHeaders
            );
            done();
        });
    });
});
