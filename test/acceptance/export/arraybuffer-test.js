'use strict';

require('../../helper');
require('../../support/assert');

var server = require('../../../lib/server')();
var assert = require('assert');
var querystring = require('querystring');

describe('export.arraybuffer', function () {
    it('GET /api/v1/sql as arraybuffer ', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECT cartodb_id,name,1::integer,187.9 FROM untitle_table_4',
                format: 'arraybuffer'
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            assert.strictEqual(res.headers['content-type'], 'application/octet-stream');
            done();
        });
    });

    it('GET /api/v1/sql as arraybuffer does not support geometry types ', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECT cartodb_id, the_geom FROM untitle_table_4',
                format: 'arraybuffer'
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 400, res.body);
            var result = JSON.parse(res.body);
            assert.strictEqual(result.error[0], 'geometry types are not supported');

            done();
        });
    });
});
