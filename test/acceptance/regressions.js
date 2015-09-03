require('../helper');

var app    = require(global.settings.app_root + '/app/controllers/app')();
var assert = require('../support/assert');
var qs = require('querystring');

describe('regressions', function() {

    it.skip('issue #224: tables with . (dot) in name works and can be queried', function(done) {

        function createRequest(sqlQuery) {
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

        assert.response(app, createRequest('CREATE TABLE "foo.bar" (a int);'), responseOk,
            function(res, err) {
                if (err) {
                    return done(err);
                }

                assert.response(app, createRequest('INSERT INTO "foo.bar" (a) values (1), (2)'), responseOk,
                    function(res, err) {
                        if (err) {
                            return done(err);
                        }
                        var parsedBody = JSON.parse(res.body);
                        assert.equal(parsedBody.total_rows, 2);

                        assert.response(app, createRequest('SELECT * FROM "foo.bar"'), responseOk,
                            function(res, err) {
                                if (err) {
                                    return done(err);
                                }

                                assert.equal(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:public."foo.bar"');
                                var parsedBody = JSON.parse(res.body);
                                assert.equal(parsedBody.total_rows, 2);
                                assert.deepEqual(parsedBody.rows, [{ a: 1 }, { a: 2 }]);
                                done();
                            }
                        );
                    }
                );
            }
        );
    });

});
