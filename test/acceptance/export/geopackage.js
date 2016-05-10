require('../../helper');

var app = require(global.settings.app_root + '/app/app')();
var assert = require('../../support/assert');
var sqlite = require('sqlite3');
var fs      = require('fs');

describe('geopackage query', function(){
    // Default name, cartodb-query, fails because of the hyphen.
    var table_name = 'a_gpkg_table';

    var base_url = '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%204&format=geopackage&filename=';

    it('returns a valid geopackage database', function(done){
        assert.response(app, {
            url: base_url + table_name,
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        },{ }, function(res) {
            assert.equal(res.statusCode, 200, res.body);
            assert.equal(res.headers["content-type"], "application/x-sqlite3; charset=utf-8");
            console.log(res.headers["content-disposition"])
            // assert.notEqual(res.headers["content-disposition"].indexOf(table_name + ".gpkg"), -1);
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
            url: base_url + table_name,
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        },{ }, function(res) {
            var tmpfile = '/tmp/a_geopackage_file.gpkg';
            try {
              fs.writeFileSync(tmpfile, res.body, 'utf16');
            } catch(err) {
              debugger
                return done(err);
            }

            debugger

            var db = new sqlite.Database(tmpfile, function(err) {
              var schemaQuery = "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name";
              var qr = db.get(schemaQuery, function(err){
                debugger
                  assert.equal(err, null);
                  // done();

                  fs.unlinkSync(tmpfile);
                  // done();
              });
              assert.notEqual(qr, undefined);

              // var gpkgQuery = "SELECT * FROM a_gpkg_table";
              // var gqr = db.get(gpkgQuery, function(err){
              //   debugger
              //     assert.ok(!err, err.toString());
              //     // done();
              // });
              // assert.notEqual(gqr, undefined);
              //
              // var gpkgQuery2 = "SELECT table_name FROM gpkg_contents";
              // var gqr2 = db.get(gpkgQuery2, function(err){
              //   debugger
              //     assert.ok(!err, err.toString());
              //     // done();
              // });
              // assert.notEqual(gqr2, undefined);
            });
        });
    });

});
