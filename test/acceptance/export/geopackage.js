require('../../helper');

var app = require(global.settings.app_root + '/app/app')();
var assert = require('../../support/assert');
var sqlite = require('sqlite3');

describe('geopackage query', function(){
    // Default name, cartodb-query, fails because of the hyphen.
    var table_name = 'a_gpkg_table'

    it('returns a valid geopackage database', function(done){
        assert.response(app, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=geopackage&filename=' + table_name,
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        },{ }, function(res) {
            assert.equal(res.statusCode, 200, res.body);
            assert.equal(res.headers["content-type"], "application/x-sqlite3; charset=utf-8");
            console.log(res.headers["content-disposition"])
            assert.notEqual(res.headers["content-disposition"].indexOf(table_name + ".gpkg"), -1);
            var db = new sqlite.Database(':memory:', res.body);
            var qr = db.get("PRAGMA database_list", function(err){
                assert.equal(err, null);
                done();
            });
            assert.notEqual(qr, undefined);
        });

    });

    it('gets database and geopackage schema', function(done){
        assert.response(app, {
            url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=geopackage&filename=' + table_name,
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        },{ }, function(res) {
            var db = new sqlite.Database(':memory:', res.body);
            var schemaQuery = "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name";
            var qr = db.get(schemaQuery, function(err){
                assert.equal(err, null);
                done();
            });
            assert.notEqual(qr, undefined);

            var gpkgQuery = "SELECT table_name FROM gpkg_contents";
            var gqr = db.get(gpkgQuery, function(err){
                assert.equal(err, null);
                done();
            });
            assert.notEqual(gqr, undefined);
        });
    });

});
