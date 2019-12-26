'use strict';

require('../helper');

var server = require('../../lib/server')();
var assert = require('../support/assert');
var querystring = require('querystring');

describe('system-queries', function () {
    var systemQueriesSuitesToTest = [
        {
            desc: 'pg_ queries work with api_key and fail otherwise',
            queries: [
                'SELECT * FROM pg_attribute',
                'SELECT * FROM PG_attribute',
                'SELECT * FROM "pg_attribute"',
                'SELECT a.* FROM untitle_table_4 a,pg_attribute',
                'SELECT * FROM geometry_columns'
            ],
            api_key_works: true,
            no_api_key_works: false
        },
        {
            desc: 'Possible false positive queries will work with api_key and without it',
            queries: [
                "SELECT 'pg_'",
                'SELECT pg_attribute FROM ( select 1 as pg_attribute ) as f',
                'SELECT * FROM cpg_test'
            ],
            api_key_works: true,
            no_api_key_works: true
        }
    ];

    systemQueriesSuitesToTest.forEach(function (suiteToTest) {
        var apiKeyStatusErrorCode = suiteToTest.api_key_works ? 200 : 403;
        testSystemQueries(suiteToTest.desc + ' with api_key', suiteToTest.queries, apiKeyStatusErrorCode, '1234');
        var noApiKeyStatusErrorCode = suiteToTest.no_api_key_works ? 200 : 403;
        testSystemQueries(suiteToTest.desc, suiteToTest.queries, noApiKeyStatusErrorCode);
    });

    function testSystemQueries (description, queries, statusErrorCode, apiKey) {
        queries.forEach(function (query) {
            it('[' + description + ']  query: ' + query, function (done) {
                var queryStringParams = { q: query };
                if (apiKey) {
                    queryStringParams.api_key = apiKey;
                }
                var request = {
                    headers: { host: 'vizzuality.cartodb.com' },
                    method: 'GET',
                    url: '/api/v1/sql?' + querystring.stringify(queryStringParams)
                };
                assert.response(server, request, function (err, response) {
                    assert.ifError(err);
                    assert.strictEqual(response.statusCode, statusErrorCode);
                    done();
                });
            });
        });
    }
});
