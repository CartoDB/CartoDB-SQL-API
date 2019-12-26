'use strict';

require('../helper');

var server = require('../../lib/server')();
var assert = require('../support/assert');
var querystring = require('querystring');

describe('stream-responses', function () {
    function createFailingQueryRequest (format) {
        var params = {
            q: 'SELECT the_geom, 100/(cartodb_id - 3) cdb_ratio FROM untitle_table_4'
        };

        if (format) {
            params.format = format;
        }

        return {
            url: '/api/v1/sql?' + querystring.stringify(params),
            headers: {
                host: 'vizzuality.cartodb.com'
            },
            method: 'GET'
        };
    }

    var okResponse = {
        status: 200
    };

    describe('format-json', function () {
        it('should close on error and error message must be part of the response', function (done) {
            assert.response(
                server,
                createFailingQueryRequest(),
                okResponse,
                function (err, res) {
                    assert.ifError(err);
                    var parsedBody = JSON.parse(res.body);
                    assert.strictEqual(parsedBody.rows.length, 2);
                    assert.deepStrictEqual(parsedBody.error, ['division by zero']);
                    done();
                }
            );
        });
    });

    describe('format-geojson', function () {
        it('should close on error and error message must be part of the response', function (done) {
            assert.response(
                server,
                createFailingQueryRequest('geojson'),
                okResponse,
                function (err, res) {
                    assert.ifError(err);
                    var parsedBody = JSON.parse(res.body);
                    assert.strictEqual(parsedBody.features.length, 2);
                    assert.deepStrictEqual(parsedBody.error, ['division by zero']);
                    done();
                }
            );
        });
    });
});
