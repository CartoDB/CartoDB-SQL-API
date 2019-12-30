'use strict';

require('../../helper');

var server = require('../../../lib/server')();
var assert = require('../../support/assert');
var querystring = require('querystring');

describe('export.svg', function () {
    it('GET /api/v1/sql with SVG format', function (done) {
        var query = querystring.stringify({
            q: 'SELECT 1 as cartodb_id, ST_MakeLine(ST_MakePoint(10, 10), ST_MakePoint(1034, 778)) AS the_geom ',
            format: 'svg'
        });
        assert.response(server, {
            url: '/api/v1/sql?' + query,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.ok(/filename=cartodb-query.svg/gi.test(cd), cd);
            assert.strictEqual(res.headers['content-type'], 'image/svg+xml; charset=utf-8');
            assert.ok(res.body.indexOf('<path d="M 0 768 L 1024 0" />') > 0, res.body);
            // TODO: test viewBox
            done();
        });
    });

    it('POST /api/v1/sql with SVG format', function (done) {
        var query = querystring.stringify({
            q: 'SELECT 1 as cartodb_id, ST_MakeLine(ST_MakePoint(10, 10), ST_MakePoint(1034, 778)) AS the_geom ',
            format: 'svg'
        });
        assert.response(server, {
            url: '/api/v1/sql',
            data: query,
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'SVG is not disposed as attachment: ' + cd);
            assert.ok(/filename=cartodb-query.svg/gi.test(cd), cd);
            assert.strictEqual(res.headers['content-type'], 'image/svg+xml; charset=utf-8');
            assert.ok(res.body.indexOf('<path d="M 0 768 L 1024 0" />') > 0, res.body);
            // TODO: test viewBox
            done();
        });
    });

    it('GET /api/v1/sql with SVG format and custom filename', function (done) {
        var query = querystring.stringify({
            q: 'SELECT 1 as cartodb_id, ST_MakeLine(ST_MakePoint(10, 10), ST_MakePoint(1034, 778)) AS the_geom ',
            format: 'svg',
            filename: 'mysvg'
        });
        assert.response(server, {
            url: '/api/v1/sql?' + query,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.ok(/filename=mysvg.svg/gi.test(cd), cd);
            assert.strictEqual(res.headers['content-type'], 'image/svg+xml; charset=utf-8');
            assert.ok(res.body.indexOf('<path d="M 0 768 L 1024 0" />') > 0, res.body);
            // TODO: test viewBox
            done();
        });
    });

    it('GET /api/v1/sql with SVG format and centered point', function (done) {
        var query = querystring.stringify({
            q: 'SELECT 1 as cartodb_id, ST_MakePoint(5000, -54) AS the_geom ',
            format: 'svg'
        });
        assert.response(server, {
            url: '/api/v1/sql?' + query,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.ok(/filename=cartodb-query.svg/gi.test(cd), cd);
            assert.strictEqual(res.headers['content-type'], 'image/svg+xml; charset=utf-8');
            assert.ok(res.body.indexOf('cx="0" cy="0"') > 0, res.body);
            // TODO: test viewBox
            // TODO: test radius
            done();
        });
    });

    it('GET /api/v1/sql with SVG format and trimmed decimals', function (done) {
        var queryobj = {
            q: "SELECT 1 as cartodb_id, 'LINESTRING(0 0, 1024 768, 500.123456 600.98765432)'::geometry AS the_geom ",
            format: 'svg',
            dp: 2
        };
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify(queryobj),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.ok(/filename=cartodb-query.svg/gi.test(cd), cd);
            assert.strictEqual(res.headers['content-type'], 'image/svg+xml; charset=utf-8');
            assert.ok(res.body.indexOf('<path d="M 0 768 L 1024 0 500.12 167.01" />') > 0, res.body);
            // TODO: test viewBox

            queryobj.dp = 3;
            assert.response(server, {
                url: '/api/v1/sql?' + querystring.stringify(queryobj),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            }, {}, function (err, res) {
                assert.ifError(err);
                assert.strictEqual(res.statusCode, 200, res.body);
                var cd = res.headers['content-disposition'];
                assert.strictEqual(true, /^attachment/.test(cd), 'SVG is not disposed as attachment: ' + cd);
                assert.ok(/filename=cartodb-query.svg/gi.test(cd), cd);
                assert.strictEqual(res.headers['content-type'], 'image/svg+xml; charset=utf-8');
                assert.ok(res.body.indexOf('<path d="M 0 768 L 1024 0 500.123 167.012" />') > 0, res.body);
                // TODO: test viewBox
                done();
            });
        });
    });

    // Test adding "the_geom" to skipfields
    // See http://github.com/Vizzuality/CartoDB-SQL-API/issues/73
    it('SVG format with "the_geom" in skipfields', function (done) {
        var query = querystring.stringify({
            q: 'SELECT 1 as cartodb_id, ST_MakePoint(5000, -54) AS the_geom ',
            format: 'svg',
            skipfields: 'the_geom'
        });
        assert.response(server, {
            url: '/api/v1/sql?' + query,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 400, res.statusCode + ': ' + res.body);
            assert.deepStrictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.deepStrictEqual(res.headers['content-disposition'], 'inline');
            assert.deepStrictEqual(JSON.parse(res.body), {
                error: ['column "the_geom" does not exist']
            });
            done();
        });
    });

    it('SVG format with missing "the_geom" field', function (done) {
        var query = querystring.stringify({
            q: 'SELECT 1 as cartodb_id, ST_MakePoint(5000, -54) AS something_else ',
            format: 'svg'
        });
        assert.response(server, {
            url: '/api/v1/sql?' + query,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 400, res.statusCode + ': ' + res.body);
            assert.deepStrictEqual(JSON.parse(res.body), {
                error: ['column "the_geom" does not exist']
            });
            done();
        });
    });

    it('should close on error and error must be the only key in the body', function (done) {
        assert.response(
            server,
            {
                url: '/api/v1/sql?' + querystring.stringify({
                    q: 'SELECT the_geom, 100/(cartodb_id - 3) cdb_ratio FROM untitle_table_4',
                    format: 'svg'
                }),
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'GET'
            },
            {
                status: 400
            },
            function (err, res) {
                assert.ifError(err);
                var parsedBody = JSON.parse(res.body);
                assert.deepStrictEqual(Object.keys(parsedBody), ['error']);
                assert.deepStrictEqual(parsedBody.error, ['division by zero']);
                done();
            }
        );
    });
});
