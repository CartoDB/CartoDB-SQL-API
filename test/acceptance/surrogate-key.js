'use strict';

require('../helper');

var server = require('../../app/server')();
var assert = require('../support/assert');
var querystring = require('querystring');
var QueryTables = require('cartodb-query-tables');
var _ = require('underscore');

describe('Surrogate-Key header', function() {

    function createGetRequest(sqlQuery) {
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

    function surrogateKeyHasTables(surrogateKey, expectedTables) {

        var surrogateKeys = surrogateKey.split(" ");

        var expectedSurrogateKeys = new QueryTables.DatabaseTablesEntry(expectedTables).key();

        assert.equal(surrogateKeys.length, expectedSurrogateKeys.length);

        var tablesDiff = _.difference(surrogateKeys, expectedSurrogateKeys);
        assert.equal(tablesDiff.length, 0, 'Surrogate-Key missing tables: ' + tablesDiff.join(','));
    }


    function tableNamesInSurrogateKeyHeader(expectedTableNames, done) {
        return function(err, res) {
            surrogateKeyHasTables(res.headers['surrogate-key'], expectedTableNames);
            done();
        };
    }

    it('supports joins', function(done) {
        var sql = "SELECT a.name as an, b.name as bn FROM untitle_table_4 a " +
                "left join private_table b ON (a.cartodb_id = b.cartodb_id)";

        assert.response(server, createGetRequest(sql), RESPONSE_OK, tableNamesInSurrogateKeyHeader([
            {dbname: 'cartodb_test_user_1_db', schema_name: 'public', table_name: 'private_table'},
            {dbname: 'cartodb_test_user_1_db', schema_name: 'public', table_name: 'untitle_table_4'}
        ], done));
    });

    it('supports multistatements', function(done) {
        var sql = "SELECT * FROM untitle_table_4; SELECT * FROM private_table";

        assert.response(server, createGetRequest(sql), RESPONSE_OK, tableNamesInSurrogateKeyHeader([
            {dbname: 'cartodb_test_user_1_db', schema_name: 'public', table_name: 'private_table'},
            {dbname: 'cartodb_test_user_1_db', schema_name: 'public', table_name: 'untitle_table_4'}
        ], done));
    });

    it('supports explicit transactions', function(done) {
        var sql =  "BEGIN; SELECT * FROM untitle_table_4; COMMIT; BEGIN; SELECT * FROM private_table; COMMIT;";

        assert.response(server, createGetRequest(sql), RESPONSE_OK, tableNamesInSurrogateKeyHeader([
            {dbname: 'cartodb_test_user_1_db', schema_name: 'public', table_name: 'private_table'},
            {dbname: 'cartodb_test_user_1_db', schema_name: 'public', table_name: 'untitle_table_4'}
        ], done));
    });

    it('survives partial transactions', function(done) {
        var sql = "BEGIN; SELECT * FROM untitle_table_4";

        assert.response(server, createGetRequest(sql), RESPONSE_OK, tableNamesInSurrogateKeyHeader([
            {dbname: 'cartodb_test_user_1_db', schema_name: 'public', table_name: 'untitle_table_4'}
        ], done));
    });

    it('should not add header for functions', function(done) {
        var sql = "SELECT format('%s', 'wadus')";
        assert.response(server, createGetRequest(sql), RESPONSE_OK, function(err, res) {
            assert.ok(!res.headers.hasOwnProperty('surrogate-key'), res.headers['surrogate-key']);
            done();
        });
    });

    it('should not add header for CDB_QueryTables', function(done) {
        var sql = "SELECT CDB_QueryTablesText('select * from untitle_table_4')";
        assert.response(server, createGetRequest(sql), RESPONSE_OK, function(err, res) {
            assert.ok(!res.headers.hasOwnProperty('surrogate-key'), res.headers['surrogate-key']);
            done();
        });
    });

    it('should not add header for non table results', function(done) {
        var sql = "SELECT 'wadus'::text";
        assert.response(server, createGetRequest(sql), RESPONSE_OK, function(err, res) {
            assert.ok(!res.headers.hasOwnProperty('surrogate-key'), res.headers['surrogate-key']);
            done();
        });
    });

});
