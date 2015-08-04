require('../helper');

var assert = require('../support/assert');
var qs = require('querystring');
var request = require('request');

describe('transaction', function() {

    var SERVER_PORT = 5554;

    var server;
    beforeEach(function(done) {
        server = require(global.settings.app_root + '/app/controllers/app')();
        server.listen(SERVER_PORT, '127.0.0.1', done);
    });

    afterEach(function(done) {
        global.settings.db_pool_destroy_client_on_error = true;
        server.close(done);
    });

    var sqlRequest = request.defaults({
        headers: { host: 'vizzuality.localhost' }
    });

    function createRequest(query) {
        return 'http://127.0.0.1:' + SERVER_PORT + '/api/v1/sql?' + qs.stringify({ q: query });
    }


    var destroyOnErrorScenarios = [
        {
            destroyOnError: true,
            assertFn: function (done) {
                return function (err, response, body) {
                    assert.ok(!err);
                    assert.equal(response.statusCode, 200);

                    var parsedBody = JSON.parse(body);
                    assert.ok(parsedBody);
                    assert.deepEqual(parsedBody.rows, [{ foo: 1 }]);

                    done();
                };
            }
        },
        {
            destroyOnError: false,
            assertFn: function(done) {
                return function(err, response, body) {
                    assert.ok(!err);
                    assert.equal(response.statusCode, 400);

                    var parsedBody = JSON.parse(body);
                    assert.ok(parsedBody);
                    assert.deepEqual(
                        parsedBody.error,
                        ['current transaction is aborted, commands ignored until end of transaction block']
                    );

                    // do extra request to clean up scenario
                    global.settings.db_pool_destroy_client_on_error = true;
                    sqlRequest(createRequest('select 1'), done);
                };
            }
        }
    ];

    var errorQuery = 'BEGIN; PREPARE _pstm AS select error; EXECUTE _pstm; COMMIT;';

    destroyOnErrorScenarios.forEach(function(scenario) {
        var shouldOrShouldNot = scenario.destroyOnError ? ' NOT ' : ' ';
        it('should' + shouldOrShouldNot + 'fail to second request after error in transaction', function(done) {
            global.settings.db_pool_destroy_client_on_error = scenario.destroyOnError;

            sqlRequest(createRequest(errorQuery), function(err, response, body) {
                assert.ok(!err);
                assert.equal(response.statusCode, 400);

                var parsedBody = JSON.parse(body);
                assert.ok(parsedBody);
                assert.deepEqual(parsedBody, { error: ['column "error" does not exist'] });

                sqlRequest(createRequest('select 1 as foo'), scenario.assertFn(done));
            });
        });
    });

});
