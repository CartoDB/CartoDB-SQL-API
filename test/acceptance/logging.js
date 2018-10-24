'use strict';

require('../helper');

var appServer = require('../../app/server');
var assert = require('../support/assert');
var qs = require('querystring');
var log4js = require('log4js');

describe('Logging SQL query on POST requests', function() {

    var SQL_QUERY = "SELECT 'wadus'";
    var API_KEY = 1234;
    var BODY_PAYLOAD = {
        q: SQL_QUERY,
        api_key: API_KEY
    };

    var RESPONSE_OK = {
        statusCode: 200
    };

    var server;
    before(function() {
        global.settings.log_format = ':method :req[Host]:url :status :sql';
        global.log4js = log4js;
        global.log4js.configure({
            appenders: [
                {
                    type: "console",
                    layout: {
                        type:'basic'
                    }
                }
            ]
        });
        server = appServer();
    });

    after(function() {
        global.log4js = null;
        delete global.log4js;
    });

    function createPostRequest(body, contentType, getParams) {
        var url = '/api/v1/sql';
        if (getParams) {
            url += '?' + qs.stringify(getParams);
        }
        return {
            method: 'POST',
            url: url,
            data: body,
            headers: {
                host: 'vizzuality.cartodb.com',
                'Content-Type': contentType
            }
        };
    }

    var LENGHTY_SUFFIX = ' [...]';

    var postScenariosRequests = [
        {
            desc: 'should return json string for application/x-www-form-urlencoded',
            request: createPostRequest(
                qs.stringify(BODY_PAYLOAD), 'application/x-www-form-urlencoded'
            )
        },
        {
            desc: 'should return json string for application/x-www-form-urlencoded, with API key in GET param',
            request: createPostRequest(
                qs.stringify({q: SQL_QUERY}), 'application/x-www-form-urlencoded', {api_key: API_KEY}
            )
        },
        {
            desc: 'should return json string for application/json',
            request: createPostRequest(
                JSON.stringify(BODY_PAYLOAD), 'application/json'
            )
        },
        {
            desc: 'should return json string for application/json, with API key in GET param',
            request: createPostRequest(
                JSON.stringify({q: SQL_QUERY}), 'application/json', {api_key: API_KEY}
            )
        },
        {
            desc: 'should return a substring when sql query is very long',
            request: createPostRequest(
                JSON.stringify({q: "select '" + new Array(2500).join('a') +  "'"}), 'application/json'
            ),
            expectedSQLQueryToLog: "select '" + (new Array(2000 + 1 - "select '".length).join('a')) + LENGHTY_SUFFIX
        }
    ];

    postScenariosRequests.forEach(function(scenario) {
        it(scenario.desc, function(done) {
            var called = 0;

            var getSqlQueryFromRequestBodyFn = server.getSqlQueryFromRequestBody;

            server.getSqlQueryFromRequestBody = function(req) {
                called++;
                var result = getSqlQueryFromRequestBodyFn(req);
                assert.deepEqual(JSON.parse(result), {q: scenario.expectedSQLQueryToLog || SQL_QUERY});
                return result;
            };

            assert.response(server, scenario.request, RESPONSE_OK, function(err) {
                assert.ok(!err);
                assert.equal(called, 1);

                server.getSqlQueryFromRequestBody = getSqlQueryFromRequestBodyFn;

                done();
            });
        });
    });

    it('should not log sql query in GET requests', function(done) {
        var called = 0;

        var getSqlQueryFromRequestBodyFn = server.getSqlQueryFromRequestBody;

        server.getSqlQueryFromRequestBody = function(req) {
            called++;
            var result = getSqlQueryFromRequestBodyFn(req);
            assert.equal(result, '');
            return result;
        };

        assert.response(server,
            {
                method: 'GET',
                url: '/api/v1/sql?' + qs.stringify(BODY_PAYLOAD),
                headers: {
                    host: 'vizzuality.cartodb.com'
                }
            },
            RESPONSE_OK,
            function(err) {
                assert.ok(!err);
                assert.equal(called, 1);

                server.getSqlQueryFromRequestBody = getSqlQueryFromRequestBodyFn;

                done();
            }
        );
    });
});
