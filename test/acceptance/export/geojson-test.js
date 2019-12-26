'use strict';

require('../../helper');

var server = require('../../../lib/server')();
var assert = require('../../support/assert');
var querystring = require('querystring');

// use decSep for internationalization
var checkDecimals = function (x, decSep) {
    var tmp = '' + x;
    if (tmp.indexOf(decSep) > -1) {
        return tmp.length - tmp.indexOf(decSep) - 1;
    } else {
        return 0;
    }
};

describe('export.geojson', function () {
// GEOJSON tests

    it('GET /api/v1/sql with SQL parameter, ensuring content-disposition set to geojson', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'GEOJSON is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=cartodb-query.geojson/gi.test(cd));
            done();
        });
    });

    it('POST /api/v1/sql with SQL parameter, ensuring content-disposition set to geojson', function (done) {
        assert.response(server, {
            url: '/api/v1/sql',
            data: querystring.stringify({ q: 'SELECT * FROM untitle_table_4', format: 'geojson' }),
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'GEOJSON is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=cartodb-query.geojson/gi.test(cd));
            done();
        });
    });

    it('uses the last format parameter when multiple are used', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?format=csv&q=SELECT%20*%20FROM%20untitle_table_4&format=geojson',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /filename=cartodb-query.geojson/gi.test(cd));
            done();
        });
    });

    it('uses custom filename', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson&filename=x',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /filename=x.geojson/gi.test(cd), cd);
            done();
        });
    });

    it('does not include the_geom and the_geom_webmercator properties by default', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var parsedBody = JSON.parse(res.body);
            var row0 = parsedBody.features[0].properties;
            var checkfields = { name: 1, cartodb_id: 1, the_geom: 0, the_geom_webmercator: 0 };
            for (var f in checkfields) {
                if (checkfields[f]) {
                    assert.ok(Object.prototype.hasOwnProperty.call(row0, f), "result does not include '" + f + "'");
                } else {
                    assert.ok(!Object.prototype.hasOwnProperty.call(row0, f), "result includes '" + f + "'");
                }
            }
            done();
        });
    });

    it('skipfields controls fields included in GeoJSON output', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson&skipfields=unexistant,cartodb_id',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var parsedBody = JSON.parse(res.body);
            var row0 = parsedBody.features[0].properties;
            var checkfields = { name: 1, cartodb_id: 0, the_geom: 0, the_geom_webmercator: 0 };
            for (var f in checkfields) {
                if (checkfields[f]) {
                    assert.ok(Object.prototype.hasOwnProperty.call(row0, f), "result does not include '" + f + "'");
                } else {
                    assert.ok(!Object.prototype.hasOwnProperty.call(row0, f), "result includes '" + f + "'");
                }
            }
            done();
        });
    });

    it('GET /api/v1/sql as geojson limiting decimal places', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECT ST_MakePoint(0.123,2.3456) as the_geom',
                format: 'geojson',
                dp: '1'
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var result = JSON.parse(res.body);
            assert.strictEqual(1, checkDecimals(result.features[0].geometry.coordinates[0], '.'));
            done();
        });
    });

    it('GET /api/v1/sql as geojson with default dp as 6', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECT ST_MakePoint(0.12345678,2.3456787654) as the_geom',
                format: 'geojson'
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var result = JSON.parse(res.body);
            assert.strictEqual(6, checkDecimals(result.features[0].geometry.coordinates[0], '.'));
            done();
        });
    });

    it('null geometries in geojson output', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: "SELECT 1 as gid, 'U' as name, null::geometry as the_geom ",
                format: 'geojson'
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'GEOJSON is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=cartodb-query.geojson/gi.test(cd));
            var gjson = JSON.parse(res.body);
            var expected = {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    properties: { gid: 1, name: 'U' },
                    geometry: null
                }]
            };
            assert.deepStrictEqual(gjson, expected);
            done();
        });
    });

    it('stream response handle errors', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECTT 1 as gid, null::geometry as the_geom ',
                format: 'geojson'
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 400, res.body);
            var geoJson = JSON.parse(res.body);
            assert.ok(geoJson.error);
            assert.strictEqual(geoJson.error.length, 1);
            assert.ok(geoJson.error[0].match(/^syntax error at or near.*/));
            done();
        });
    });

    it('stream response with empty result set has valid output', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECT 1 as gid, null::geometry as the_geom limit 0',
                format: 'geojson'
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var geoJson = JSON.parse(res.body);
            var expectedGeoJson = { type: 'FeatureCollection', features: [] };
            assert.deepStrictEqual(geoJson, expectedGeoJson);
            done();
        });
    });
});
