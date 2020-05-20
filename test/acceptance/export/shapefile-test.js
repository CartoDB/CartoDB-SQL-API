'use strict';

require('../../helper');

var server = require('../../../lib/server')();
var assert = require('../../support/assert');
var querystring = require('querystring');
var shapefile = require('shapefile');
const AdmZip = require('adm-zip');
var fs = require('fs');

function assertZipfileContent (content, filename = 'cartodb-query') {
    const tmpfile = '/tmp/myshape.zip';
    const err = fs.writeFileSync(tmpfile, content, 'binary');

    assert.ifError(err);

    const names = new AdmZip(tmpfile).getEntries().map(entry => entry.name);
    assert.ok(names.includes(`${filename}.shp`), `SHP zipfile does not contain .shp: ${names}`);
    assert.ok(names.includes(`${filename}.shx`), `SHP zipfile does not contain .shx: ${names}`);
    assert.ok(names.includes(`${filename}.dbf`), `SHP zipfile does not contain .dbf: ${names}`);
    assert.ok(names.includes(`${filename}.prj`), `SHP zipfile does not contain .prj: ${names}`);

    fs.unlinkSync(tmpfile);
}

describe('export.shapefile', function () {
    it('SHP format, unauthenticated', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=shp',
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'SHP is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=cartodb-query.zip/gi.test(cd));
            assertZipfileContent(res.body);
            done();
        });
    });

    it('SHP format, unauthenticated, POST', function (done) {
        assert.response(server, {
            url: '/api/v1/sql',
            data: 'q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=shp',
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'SHP is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=cartodb-query.zip/gi.test(cd), 'Unexpected SHP filename: ' + cd);
            done();
        });
    });

    it('SHP format, big size, POST', function (done) {
        assert.response(server, {
            url: '/api/v1/sql',
            data: querystring.stringify({
                q: 'SELECT 0 as fname, st_makepoint(i,i) FROM generate_series(0,81920) i',
                format: 'shp'
            }),
            headers: { host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'SHP is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=cartodb-query.zip/gi.test(cd), 'Unexpected SHP filename: ' + cd);
            assert.ok(res.body.length > 81920, 'SHP smaller than expected: ' + res.body.length);
            done();
        });
    });

    it('SHP format, unauthenticated, with custom filename', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=shp&filename=myshape',
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'SHP is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=myshape.zip/gi.test(cd));
            assertZipfileContent(res.body, 'myshape');
            done();
        });
    });

    it('SHP format, unauthenticated, with custom, dangerous filename', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=shp&filename=b;"%20()[]a',
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var fname = 'b_______a';
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'SHP is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=b_______a.zip/gi.test(cd), 'Unexpected SHP filename: ' + cd);
            var tmpfile = '/tmp/myshape.zip';
            var writeErr = fs.writeFileSync(tmpfile, res.body, 'binary');
            if (writeErr) {
                return done(writeErr);
            }
            const names = new AdmZip(tmpfile).getEntries().map(entry => entry.name);
            assert.ok(names.includes(`${fname}.shp`), `SHP zipfile does not contain .shp: ${names}`);
            assert.ok(names.includes(`${fname}.shx`), `SHP zipfile does not contain .shx: ${names}`);
            assert.ok(names.includes(`${fname}.dbf`), `SHP zipfile does not contain .dbf: ${names}`);
            assert.ok(names.includes(`${fname}.prj`), `SHP zipfile does not contain .prj: ${names}`);
            fs.unlinkSync(tmpfile);
            done();
        });
    });

    it('SHP format, authenticated', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=shp&api_key=1234',
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /filename=cartodb-query.zip/gi.test(cd));
            assertZipfileContent(res.body);
            done();
        });
    });

    // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/66
    it('SHP format, unauthenticated, with utf8 data', function (done) {
        var query = querystring.stringify({
            q: "SELECT '♥♦♣♠' as f, st_makepoint(0,0,4326) as the_geom",
            format: 'shp',
            filename: 'myshape'
        });
        assert.response(server, {
            url: '/api/v1/sql?' + query,
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var tmpfile = '/tmp/myshape.zip';
            var writeErr = fs.writeFileSync(tmpfile, res.body, 'binary');
            if (writeErr) {
                return done(writeErr);
            }
            const buffer = new AdmZip(tmpfile).getEntry('myshape.dbf').getData();
            fs.unlinkSync(tmpfile);
            var strings = buffer.toString();
            assert.ok(/♥♦♣♠/.exec(strings), "Cannot find '♥♦♣♠' in here:\n" + strings);
            done();
        });
    });

    // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/66
    it('mixed type geometry', function (done) {
        var query = querystring.stringify({
            q: "SELECT 'POINT(0 0)'::geometry as g UNION ALL SELECT 'LINESTRING(0 0, 1 0)'::geometry",
            format: 'shp'
        });
        assert.response(server, {
            url: '/api/v1/sql?' + query,
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.deepStrictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.deepStrictEqual(res.headers['content-disposition'], 'inline');
            assert.strictEqual(res.statusCode, 400, res.statusCode + ': ' + res.body);
            var parsedBody = JSON.parse(res.body);
            var error = parsedBody.error[0];
            var expectedError = /Attempt to write non-point \(LINESTRING\) geometry to point shapefile/g;
            assert.ok(expectedError.test(error), error);
            done();
        });
    });

    // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/87
    it('errors are not confused with warnings', function (done) {
        var query = querystring.stringify({
            q: [
                "SELECT 'POINT(0 0)'::geometry as g, 1 as a_very_very_very_long_field_name",
                "SELECT 'LINESTRING(0 0, 1 0)'::geometry, 2"
            ].join(' UNION ALL '),
            format: 'shp'
        });
        assert.response(server, {
            url: '/api/v1/sql?' + query,
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.deepStrictEqual(res.headers['content-type'], 'application/json; charset=utf-8');
            assert.deepStrictEqual(res.headers['content-disposition'], 'inline');
            assert.strictEqual(res.statusCode, 400, res.statusCode + ': ' + res.body);
            var parsedBody = JSON.parse(res.body);
            var error = parsedBody.error[0];
            var expectedError = /Attempt to write non-point \(LINESTRING\) geometry to point shapefile/g;
            assert.ok(expectedError.test(error), error);
            done();
        });
    });

    it('skipfields controls fields included in SHP output', function (done) {
        var query = querystring.stringify({
            q: "SELECT 111 as skipme, 222 as keepme, 'POINT(0 0)'::geometry as g",
            format: 'shp',
            skipfields: 'skipme',
            filename: 'myshape'
        });
        assert.response(server, {
            url: '/api/v1/sql?' + query,
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var tmpfile = '/tmp/myshape.zip';
            var writeErr = fs.writeFileSync(tmpfile, res.body, 'binary');
            if (writeErr) {
                return done(writeErr);
            }
            const buffer = new AdmZip(tmpfile).getEntry('myshape.dbf').getData();
            fs.unlinkSync(tmpfile);
            var strings = buffer.toString();
            assert.ok(!/skipme/.exec(strings), "Could not skip 'skipme' field:\n" + strings);
            done();
        });
    });

    it('SHP format, concurrently', function (done) {
        var concurrency = 1;
        var waiting = concurrency;
        function validate (err, res) {
            assert.ifError(err);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /^attachment/.test(cd), 'SHP is not disposed as attachment: ' + cd);
            assert.strictEqual(true, /filename=cartodb-query.zip/gi.test(cd));
            assertZipfileContent(res.body);
            if (!--waiting) {
                done();
            }
        }
        for (var i = 0; i < concurrency; ++i) {
            assert.response(
                server,
                {
                    url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=shp',
                    headers: { host: 'vizzuality.cartodb.com' },
                    encoding: 'binary',
                    method: 'GET'
                },
                {
                    status: 200
                },
                validate
            );
        }
    });

    // See https://github.com/CartoDB/CartoDB-SQL-API/issues/111
    it('point with null first', function (done) {
        var query = querystring.stringify({
            q: "SELECT null::geometry as g UNION ALL SELECT 'SRID=4326;POINT(0 0)'::geometry",
            format: 'shp'
        });
        assert.response(server, {
            url: '/api/v1/sql?' + query,
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            var cd = res.headers['content-disposition'];
            assert.strictEqual(true, /filename=cartodb-query.zip/gi.test(cd));
            assertZipfileContent(res.body);
            done();
        });
    });

    var limit = 1200;

    it('expects ' + limit + ' rows in public table', function (done) {
        var filename = 'test_1200';

        assert.response(server, {
            url: '/api/v1/sql?' + querystring.stringify({
                q: 'SELECT * from populated_places_simple_reduced limit ' + limit,
                format: 'shp',
                filename: filename
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        },
        {
            status: 200
        },
        function (err, res) {
            if (err) {
                return done(err);
            }

            var tmpShpPath = '/tmp/' + filename + '.zip';
            err = fs.writeFileSync(tmpShpPath, res.body, 'binary');
            if (err) {
                return done(err);
            }

            const zf = new AdmZip(tmpShpPath);
            zf.getEntries().forEach(entry => {
                const buffer = entry.getData();
                const tmpDbfPath = `/tmp/${entry.name}`;
                const err = fs.writeFileSync(tmpDbfPath, buffer);
                assert.ifError(err);
            });
            shapefile.read('/tmp/' + filename, function (err, collection) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(collection.features.length, limit);
                done();
            });
        }
        );
    });

    it('SHP zip, wrong path for zip command should return error', function (done) {
        global.settings.zipCommand = '/wrong/path';
        var query = querystring.stringify({
            q: 'SELECT st_makepoint(0,0,4326) as the_geom',
            format: 'shp',
            filename: 'myshape'
        });
        assert.response(server, {
            url: '/api/v1/sql?' + query,
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 400, res.body);
            var parsedBody = JSON.parse(res.body);
            var respBodyPattern = new RegExp('Error executing zip command, {2}Error: spawn(.*)ENOENT', 'i');
            assert.strictEqual(respBodyPattern.test(parsedBody.error[0]), true);
            done();
        });
    });
});
