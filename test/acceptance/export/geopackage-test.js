'use strict';

require('../../helper');

var server = require('../../../lib/server')();
var assert = require('../../support/assert');
var sqlite = require('sqlite3');
var fs = require('fs');

describe('geopackage query', function () {
    // Default name, cartodb-query, fails because of the hyphen.
    var tableName = 'a_gpkg_table';
    var baseUrl = '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=gpkg&filename=' + tableName;

    it('returns a valid geopackage database', function (done) {
        assert.response(server, {
            url: baseUrl,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            assert.strictEqual(res.headers['content-type'], 'application/x-sqlite3; charset=utf-8');
            assert.notEqual(res.headers['content-disposition'].indexOf(tableName + '.gpkg'), -1);
            var db = new sqlite.Database(':memory:', res.body);
            var qr = db.get('PRAGMA database_list', function (err) {
                assert.strictEqual(err, null);
                done();
            });
            assert.notEqual(qr, undefined);
        });
    });

    it('works with a long list of skipfields', function (done) {
        const longUrl = baseUrl + `&skipfields=the_geom_webmercator,${'a'.repeat(300)}`;
        assert.response(server, {
            url: longUrl,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            assert.strictEqual(res.headers['content-type'], 'application/x-sqlite3; charset=utf-8');
            assert.notEqual(res.headers['content-disposition'].indexOf(tableName + '.gpkg'), -1);
            var db = new sqlite.Database(':memory:', res.body);
            var qr = db.get('PRAGMA database_list', function (err) {
                assert.strictEqual(err, null);
                done();
            });
            assert.notEqual(qr, undefined);
        });
    });

    it('gets database and geopackage schema', function (done) {
        assert.response(server, {
            url: baseUrl,
            headers: { host: 'vizzuality.cartodb.com' },
            encoding: 'binary',
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            var tmpfile = '/tmp/a_geopackage_file.gpkg';
            try {
                fs.writeFileSync(tmpfile, res.body, 'binary');
            } catch (err) {
                return done(err);
            }

            var db = new sqlite.Database(tmpfile, function (err) {
                if (err) {
                    return done(err);
                }

                db.serialize(function () {
                    var schemaQuery = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
                    var sqr = db.get(schemaQuery, function (err, row) {
                        assert.ifError(err);
                        assert.strictEqual(err, null);
                        assert.strictEqual(row.name, tableName);
                    });
                    assert.notEqual(sqr, undefined);

                    var gpkgQuery = 'SELECT table_name FROM gpkg_contents';
                    var gqr = db.get(gpkgQuery, function (err, row) {
                        assert.ifError(err);
                        assert.strictEqual(row.table_name, tableName);
                        assert.strictEqual(err, null);
                    });
                    assert.notEqual(gqr, undefined);

                    var dataQuery = 'SELECT * FROM ' + tableName + ' order by cartodb_id';
                    var dqr = db.get(dataQuery, function (err, row) {
                        assert.ifError(err);
                        assert.strictEqual(row.cartodb_id, 1);
                        assert.strictEqual(row.name, 'Hawai');
                        assert.strictEqual(row.fid, undefined);
                        done();
                    });
                    assert.notEqual(dqr, undefined);
                });
            });
        });
    });
});
