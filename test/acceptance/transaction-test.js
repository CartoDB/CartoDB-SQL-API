'use strict';

require('../helper');

var assert = require('../support/assert');
var qs = require('querystring');
var request = require('request');

describe('transaction', function () {
    var SERVER_PORT = 5554;

    var server;
    before(function (done) {
        server = require('../../lib/server')();
        this.listener = server.listen(SERVER_PORT, '127.0.0.1');
        this.listener.on('listening', done);
    });

    after(function (done) {
        this.listener.close(done);
    });

    var sqlRequest = request.defaults({
        headers: { host: 'vizzuality.localhost' }
    });

    function requestUrl (query) {
        return 'http://127.0.0.1:' + SERVER_PORT + '/api/v1/sql?' + qs.stringify({ q: query });
    }

    var errorQuery = 'BEGIN; PREPARE _pstm AS select error; EXECUTE _pstm; COMMIT;';

    it('should NOT fail to second request after error in transaction', function (done) {
        sqlRequest(requestUrl(errorQuery), function (err, response, body) {
            assert.ok(!err);
            assert.strictEqual(response.statusCode, 400);

            var parsedBody = JSON.parse(body);
            assert.ok(parsedBody);
            assert.deepStrictEqual(parsedBody, { error: ['column "error" does not exist'] });

            sqlRequest(requestUrl('select 1 as foo'), function (err, response, body) {
                assert.ok(!err);
                assert.strictEqual(response.statusCode, 200);

                var parsedBody = JSON.parse(body);
                assert.ok(parsedBody);
                assert.deepStrictEqual(parsedBody.rows, [{ foo: 1 }]);

                done();
            });
        });
    });
});
