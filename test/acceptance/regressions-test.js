'use strict';

require('../helper');

var server = require('../../lib/server')();
var assert = require('../support/assert');
var qs = require('querystring');

describe('regressions', function () {
    it('issue #224: tables with . (dot) in name works and can be queried', function (done) {
        function createRequest (sqlQuery) {
            return {
                url: '/api/v1/sql?' + qs.stringify({
                    q: sqlQuery,
                    api_key: 1234
                }),
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'GET'
            };
        }

        var responseOk = {
            statusCode: 200
        };

        assert.response(server, createRequest('CREATE TABLE "foo.bar" (a int);'), responseOk,
            function (err) {
                if (err) {
                    return done(err);
                }

                assert.response(server, createRequest('INSERT INTO "foo.bar" (a) values (1), (2)'), responseOk,
                    function (err, res) {
                        if (err) {
                            return done(err);
                        }
                        var parsedBody = JSON.parse(res.body);
                        assert.strictEqual(parsedBody.total_rows, 2);

                        assert.response(server, createRequest('SELECT * FROM "foo.bar"'), responseOk,
                            function (err, res) {
                                if (err) {
                                    return done(err);
                                }

                                // table should not get a cache channel as it won't get invalidated
                                assert.ok(!Object.prototype.hasOwnProperty.call(res.headers, 'x-cache-channel'));
                                var parsedBody = JSON.parse(res.body);
                                assert.strictEqual(parsedBody.total_rows, 2);
                                assert.deepStrictEqual(parsedBody.rows, [{ a: 1 }, { a: 2 }]);

                                // delete table
                                assert.response(server, createRequest('DROP TABLE "foo.bar"'), responseOk, done);
                            }
                        );
                    }
                );
            }
        );
    });
});
