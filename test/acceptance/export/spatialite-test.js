'use strict';

require('../../helper');

var server = require('../../../lib/server')();
var assert = require('../../support/assert');
var sqlite = require('sqlite3');

describe('spatialite query', function () {
    it('returns a valid sqlite database', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=spatialite',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.statusCode, 200, res.body);
            assert.strictEqual(res.headers['content-type'], 'application/x-sqlite3; charset=utf-8');
            var db = new sqlite.Database(':memory:', res.body);
            var qr = db.get('PRAGMA database_list', function (err) {
                assert.strictEqual(err, null);
                done();
            });
            assert.notEqual(qr, undefined);
        });
    });

    it('different file name', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=spatialite&filename=manolo',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.headers['content-type'], 'application/x-sqlite3; charset=utf-8');
            assert.notEqual(res.headers['content-disposition'].indexOf('manolo.sqlite'), -1);
            done();
        });
    });

    it('gets database schema', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=spatialite',
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        }, { }, function (err, res) {
            assert.ifError(err);
            var db = new sqlite.Database(':memory:', res.body);
            var schemaQuery = "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name";
            var qr = db.get(schemaQuery, function (err) {
                assert.strictEqual(err, null);
                done();
            });
            assert.notEqual(qr, undefined);
        });
    });
});
