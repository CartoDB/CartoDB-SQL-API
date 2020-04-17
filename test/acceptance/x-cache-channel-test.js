'use strict';

require('../helper');

var server = require('../../lib/server')();
var assert = require('../support/assert');
var querystring = require('querystring');
var _ = require('underscore');

describe('X-Cache-Channel header', function () {
    function createGetRequest (sqlQuery) {
        var query = querystring.stringify({
            q: sqlQuery,
            api_key: 1234
        });
        return {
            url: '/api/v1/sql?' + query,
            headers: {
                host: 'vizzuality.cartodb.com'
            },
            method: 'GET'
        };
    }

    var RESPONSE_OK = {
        statusCode: 200
    };

    function xCacheChannelHeaderHasTables (xCacheChannel, expectedTablesNames) {
        var databaseAndTables = xCacheChannel.split(':');
        var databaseName = databaseAndTables[0];

        assert.strictEqual(databaseName, 'cartodb_test_user_1_db');

        var headerTableNames = databaseAndTables[1].split(',');
        assert.strictEqual(headerTableNames.length, expectedTablesNames.length);

        var tablesDiff = _.difference(expectedTablesNames, headerTableNames);
        assert.strictEqual(tablesDiff.length, 0, 'X-Cache-Channel header missing tables: ' + tablesDiff.join(','));
    }

    function tableNamesInCacheChannelHeader (expectedTableNames, done) {
        return function (err, res) {
            assert.ifError(err);
            xCacheChannelHeaderHasTables(res.headers['x-cache-channel'], expectedTableNames);
            done();
        };
    }

    it('supports joins', function (done) {
        var sql = 'SELECT a.name as an, b.name as bn FROM untitle_table_4 a ' +
            'left join private_table b ON (a.cartodb_id = b.cartodb_id)';

        assert.response(server, createGetRequest(sql), RESPONSE_OK, tableNamesInCacheChannelHeader([
            'public.private_table',
            'public.untitle_table_4'
        ], done));
    });

    it('supports multistatements', function (done) {
        var sql = 'SELECT * FROM untitle_table_4; SELECT * FROM private_table';

        assert.response(server, createGetRequest(sql), RESPONSE_OK, tableNamesInCacheChannelHeader([
            'public.private_table',
            'public.untitle_table_4'
        ], done));
    });

    it('supports explicit transactions', function (done) {
        var sql = 'BEGIN; SELECT * FROM untitle_table_4; COMMIT; BEGIN; SELECT * FROM private_table; COMMIT;';

        assert.response(server, createGetRequest(sql), RESPONSE_OK, tableNamesInCacheChannelHeader([
            'public.private_table',
            'public.untitle_table_4'
        ], done));
    });

    it('survives partial transactions', function (done) {
        var sql = 'BEGIN; SELECT * FROM untitle_table_4';

        assert.response(server, createGetRequest(sql), RESPONSE_OK, tableNamesInCacheChannelHeader([
            'public.untitle_table_4'
        ], done));
    });

    it('should not add header for functions', function (done) {
        var sql = "SELECT format('%s', 'wadus')";
        assert.response(server, createGetRequest(sql), RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            assert.ok(!Object.prototype.hasOwnProperty.call(res.headers, 'x-cache-channel'), res.headers['x-cache-channel']);
            done();
        });
    });

    it('should not add header for CDB_QueryTables', function (done) {
        var sql = "SELECT cartodb.CDB_QueryTablesText('select * from untitle_table_4')";
        assert.response(server, createGetRequest(sql), RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            assert.ok(!Object.prototype.hasOwnProperty.call(res.headers, 'x-cache-channel'), res.headers['x-cache-channel']);
            done();
        });
    });

    it('should not add header for non table results', function (done) {
        var sql = "SELECT 'wadus'::text";
        assert.response(server, createGetRequest(sql), RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            assert.ok(!Object.prototype.hasOwnProperty.call(res.headers, 'x-cache-channel'), res.headers['x-cache-channel']);
            done();
        });
    });
});
