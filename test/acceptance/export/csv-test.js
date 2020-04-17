'use strict';

require('../../helper');
require('../../support/assert');

var server = require('../../../lib/server')();
var assert = require('assert');
var querystring = require('querystring');

describe('export.csv', function () {
    it('CSV format', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECT * FROM untitle_table_4 WHERE cartodb_id = 1',
                format: 'csv'
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'CSV is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=cartodb-query.csv/gi.test(cd));
            var ct = res.headers['content-type'];
            assert.strictEqual(true, /header=present/.test(ct), "CSV doesn't advertise header presence: " + ct);

            var rows = res.body.split(/\r\n/);
            var row0 = rows[0].split(',');
            var row1 = rows[1].split(',');

            assert.strictEqual(row0[2], 'created_at');
            assert.strictEqual(row1[2], '2011-09-21 14:02:21.314252');

            done();
        });
    });

    it('CSV format, bigger than 81920 bytes', function (done) {
        assert.response(server, {
            url: '/api/v1/sql',
            data: querystring.stringify({
                q: 'SELECT 0 as fname FROM generate_series(0,81920)',
                format: 'csv'
            }),
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.ok(res.body.length > 81920, 'CSV smaller than expected: ' + res.body.length);
            done();
        });
    });

    it('CSV format from POST', function (done) {
        assert.response(server, {
            url: '/api/v1/sql',
            data: querystring.stringify({ q: 'SELECT * FROM untitle_table_4 LIMIT 1', format: 'csv' }),
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'CSV is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=cartodb-query.csv/gi.test(cd));
            var ct = res.headers['content-type'];
            assert.strictEqual(true, /header=present/.test(ct), "CSV doesn't advertise header presence: " + ct);
            done();
        });
    });

    it('CSV format, custom filename', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=csv&filename=mycsv.csv',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'CSV is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=mycsv.csv/gi.test(cd), cd);
            var ct = res.headers['content-type'];
            assert.strictEqual(true, /header=present/.test(ct), "CSV doesn't advertise header presence: " + ct);
            var row0 = res.body.substring(0, res.body.search(/[\n\r]/)).split(',');
            var checkFields = { name: true, cartodb_id: true, the_geom: true, the_geom_webmercator: true };
            Object.keys(checkFields).forEach(function (f) {
                var idx = row0.indexOf(f);
                if (checkFields[f]) {
                    assert.ok(idx !== -1, "result does not include '" + f + "'");
                } else {
                    assert.ok(idx === -1, "result includes '" + f + "' (" + idx + ')');
                }
            });
            done();
        });
    });

    it('skipfields controls fields included in CSV output', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=csv' +
            '&skipfields=unexistant,cartodb_id',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var row0 = res.body.substring(0, res.body.search(/[\n\r]/)).split(',');
            var checkFields = { name: true, cartodb_id: false, the_geom: true, the_geom_webmercator: true };
            Object.keys(checkFields).forEach(function (f) {
                var idx = row0.indexOf(f);
                if (checkFields[f]) {
                    assert.ok(idx !== -1, "result does not include '" + f + "'");
                } else {
                    assert.ok(idx === -1, "result includes '" + f + "' (" + idx + ')');
                }
            });
            done();
        });
    });

    it('GET /api/v1/sql as csv', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20cartodb_id,ST_AsEWKT(the_geom)%20as%20geom%20FROM%20untitle_table_4%20LIMIT%201' +
            '&format=csv',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            assert.ok(res.body.match(/cartodb_id,geom\r\n.?1.?,"SRID=4326;POINT(.*)"\r\n/));
            done();
        });
    });

    // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/60
    it('GET /api/v1/sql as csv with no rows', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20true%20WHERE%20false&format=csv',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var obtainedLines = res.body.split('\r\n');
            assert.ok(obtainedLines.length <= 2, // may or may not have an header
                // See http://trac.osgeo.org/gdal/ticket/5234
                'Too many lines in output (' + obtainedLines.length + '): ' + obtainedLines.join('\n'));
            done();
        });
    });

    it('GET /api/v1/sql as csv, properly escaped', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20cartodb_id,%20address%20FROM%20untitle_table_4%20LIMIT%201&format=csv',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            assert.ok(res.body.match(/cartodb_id,address\r\n.?1.?,"Calle de Pérez Galdós 9, Madrid, Spain"\r\n/));
            done();
        });
    });

    it('GET /api/v1/sql as csv, concurrently', function (done) {
        var concurrency = 4;
        var waiting = concurrency;
        function validate (err, res) {
            assert.ifError(err);
            assert.ok(res.body.match(/cartodb_id,address\r\n.?1.?,"Calle de Pérez Galdós 9, Madrid, Spain"\r\n/));
            if (!--waiting) {
                done();
            }
        }
        for (var i = 0; i < concurrency; ++i) {
            assert.response(server,
                {
                    url: '/api/v1/sql?q=SELECT%20cartodb_id,%20address%20FROM%20untitle_table_4%20LIMIT%201&format=csv',
                    headers: { host: 'vizzuality.cartodb.com' },
                    method: 'GET'
                },
                {
                    status: 200
                },
                validate
            );
        }
    });

    it('expects 1200 rows in public table', function (done) {
        var limit = 1200;

        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECT * from populated_places_simple_reduced limit ' + limit,
                format: 'csv'
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        },
        {
            status: 200
        },
        function (err, res) {
            assert.ifError(err);
            var headersPlusExtraLine = 2;
            assert.strictEqual(res.body.split('\n').length, limit + headersPlusExtraLine);
            done();
        });
    });

    it('maintains output compatible with gdal 2.2', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECT cartodb_id, natscale, adm0cap from populated_places_simple_reduced limit 1',
                format: 'csv'
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        },
        {
            status: 200
        },
        function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.body.split('\r\n')[1], '1109,20,0');
            done();
        });
    });
});
