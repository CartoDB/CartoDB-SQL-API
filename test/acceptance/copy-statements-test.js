'use strict';

require('../helper');

var server = require('../../lib/server')();
var assert = require('../support/assert');
var querystring = require('querystring');

describe('copy-statements', function () {
    var RESPONSE_OK = {
        statusCode: 200
    };

    before(function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'CREATE TABLE copy_test_table(a int)',
                api_key: 1234
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, RESPONSE_OK, done);
    });

    after(function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'DROP TABLE IF EXISTS copy_test_table',
                api_key: 1234
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, RESPONSE_OK, done);
    });

    // Test effects of COPY
    // See https://github.com/Vizzuality/cartodb-management/issues/1502
    it('COPY TABLE with GET and auth', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'COPY copy_test_table FROM stdin;',
                api_key: 1234
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {}, function (err, res) {
            assert.ifError(err);
            // We expect a problem, actually
            assert.strictEqual(res.statusCode, 400, res.statusCode + ': ' + res.body);
            assert.deepStrictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.deepStrictEqual(res.headers['content-disposition'], 'inline');
            assert.deepStrictEqual(JSON.parse(res.body), { error: ['COPY from stdin failed: No source stream defined'] });
            done();
        });
    });

    it('COPY TABLE with GET and auth', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: "COPY copy_test_table to '/tmp/x';",
                api_key: 1234
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, {}, function (err, res) {
            assert.ifError(err);
            // We expect a problem, actually
            assert.strictEqual(res.statusCode, 400, res.statusCode + ': ' + res.body);
            assert.deepStrictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.deepStrictEqual(res.headers['content-disposition'], 'inline');
            const errorExp = /must be superuser.* to COPY.* a file/;
            const hintExp = /Anyone can COPY to stdout or from stdin. psql's \\copy command also works for anyone./;
            assert.ok(JSON.parse(res.body).error[0].match(errorExp));
            assert.ok(JSON.parse(res.body).hint.match(hintExp));
            done();
        });
    });
});
