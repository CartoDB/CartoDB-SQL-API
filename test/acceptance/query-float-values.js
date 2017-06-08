require('../helper');

var server = require('../../app/server')();
var assert = require('../support/assert');
var querystring = require('querystring');
var step = require('step');

describe('special numeric (float) values', function() {
    var RESPONSE_OK = {
        statusCode: 200
    };
    var HEADERS = {
        host: 'vizzuality.localhost.lan:8080'
    };
    var METHOD = 'GET';
    var URL = '/api/v1/sql?api_key=1234&';

    it('should cast Infinity and NaN values properly', function (done) {
        step(
            function createTable () {
                var next = this;
                var opts = {
                    url: URL + querystring.stringify({
                        q: 'create table numbers_test(val float)'
                    }),
                    headers: HEADERS,
                    method: METHOD
                };
                assert.response(server, opts, RESPONSE_OK, next);
            },
            function insertData (err) {
                assert.ifError(err);
                var next = this;
                var opts = {
                    url: URL + querystring.stringify({
                        q: 'insert into numbers_test values (\'NaN\'::float), (\'infinity\'::float), (1::float)'
                    }),
                    headers: HEADERS,
                    method: METHOD
                };
                assert.response(server, opts, RESPONSE_OK, next);
            },
            function queryData (err) {
                assert.ifError(err);
                var next = this;
                var opts = {
                    url: URL + querystring.stringify({
                        q: 'select * from numbers_test'
                    }),
                    headers: HEADERS,
                    method: METHOD
                };
                assert.response(server, opts, RESPONSE_OK, next);
            },
            function assertResult (err, res) {
                assert.ifError(err);
                var result = JSON.parse(res.body);
                assert.ok(Array.isArray(result.rows));
                result.rows.forEach(function (row) {
                    assert.ok(row.val !== null, 'special float value (Infinity or NaN) parsed to null');
                });
                done();
            }
        );
    });
});
