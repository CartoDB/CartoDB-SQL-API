require('../../helper');
require('../../support/assert');


var app    = require(global.settings.app_root + '/app/controllers/app')()
    , assert = require('assert')
    , querystring = require('querystring')
    , _ = require('underscore')
    , zipfile = require('zipfile')
    , fs      = require('fs')
    , libxmljs = require('libxmljs')
    ;

// allow lots of emitters to be set to silence warning
app.setMaxListeners(0);

suite('export.csv', function() {

test('CSV format', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: 'SELECT * FROM untitle_table_4 WHERE cartodb_id = 1',
          format: 'csv'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'CSV is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.csv/gi.test(cd));
        var ct = res.header('Content-Type');
        assert.equal(true, /header=present/.test(ct), "CSV doesn't advertise header presence: " + ct);

        var rows = res.body.split(/\r\n/);
        var row0 = rows[0].split(',');
        var row1 = rows[1].split(',');

        assert.equal(row0[1], 'created_at');
        assert.equal(row1[1], '2011-09-21 14:02:21.314252');

        done();
    });
});

test('CSV format, bigger than 81920 bytes', function(done){
    assert.response(app, {
        url: '/api/v1/sql',
        data: querystring.stringify({
          q: 'SELECT 0 as fname FROM generate_series(0,81920)',
          format: 'csv'
        }),
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{ }, function(res){
        assert.ok(res.body.length > 81920, 'CSV smaller than expected: ' + res.body.length);
        done();
    });
});


test('CSV format from POST', function(done){
    assert.response(app, {
        url: '/api/v1/sql',
        data: querystring.stringify({q: "SELECT * FROM untitle_table_4 LIMIT 1", format: 'csv'}),
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'CSV is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.csv/gi.test(cd));
        var ct = res.header('Content-Type');
        assert.equal(true, /header=present/.test(ct), "CSV doesn't advertise header presence: " + ct);
        done();
    });
});

test('CSV format, custom filename', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=csv&filename=mycsv.csv',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'CSV is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=mycsv.csv/gi.test(cd), cd);
        var ct = res.header('Content-Type');
        assert.equal(true, /header=present/.test(ct), "CSV doesn't advertise header presence: " + ct);
        var row0 = res.body.substring(0, res.body.search(/[\n\r]/)).split(',');
        var checkfields = {'name':1, 'cartodb_id':1, 'the_geom':1, 'the_geom_webmercator':1};
        for ( var f in checkfields ) {
          var idx = row0.indexOf(f);
          if ( checkfields[f] ) {
            assert.ok(idx != -1, "result does not include '" + f + "'");
          } else {
            assert.ok(idx == -1, "result includes '" + f + "' ("+idx+")");
          }
        }
        done();
    });
});

test('skipfields controls fields included in CSV output', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=csv&skipfields=unexistant,cartodb_id',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var row0 = res.body.substring(0, res.body.search(/[\n\r]/)).split(',');
        var checkfields = {'name':1, 'cartodb_id':0, 'the_geom':1, 'the_geom_webmercator':1};
        for ( var f in checkfields ) {
          var idx = row0.indexOf(f);
          if ( checkfields[f] ) {
            assert.ok(idx != -1, "result does not include '" + f + "'");
          } else {
            assert.ok(idx == -1, "result includes '" + f + "' ("+idx+")");
          }
        }
        done();
    });
});

test('GET /api/v1/sql as csv', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20cartodb_id,ST_AsEWKT(the_geom)%20as%20geom%20FROM%20untitle_table_4%20LIMIT%201&format=csv',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var expected = 'cartodb_id,geom\r\n1,"SRID=4326;POINT(-3.699732 40.423012)"\r\n';
        assert.equal(res.body, expected);
        done();
    });
});

// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/60
test('GET /api/v1/sql as csv with no rows', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20true%20WHERE%20false&format=csv',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var obtained_lines = res.body.split('\r\n');
        assert.ok(obtained_lines.length <= 2, // may or may not have an header
          // See http://trac.osgeo.org/gdal/ticket/5234
          'Too many lines in output (' + obtained_lines.length + '): '
          + obtained_lines.join('\n'));
        done();
    });
});

test('GET /api/v1/sql as csv, properly escaped', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20cartodb_id,%20address%20FROM%20untitle_table_4%20LIMIT%201&format=csv',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var expected = 'cartodb_id,address\r\n1,"Calle de Pérez Galdós 9, Madrid, Spain"\r\n';
        assert.equal(res.body, expected);
        done();
    });
});

test('GET /api/v1/sql as csv, concurrently', function(done){

    var concurrency = 4;
    var waiting = concurrency;
    for (var i=0; i<concurrency; ++i) {

      assert.response(app, {
          url: '/api/v1/sql?q=SELECT%20cartodb_id,%20address%20FROM%20untitle_table_4%20LIMIT%201&format=csv',
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
      },{ }, function(res){
          assert.equal(res.statusCode, 200, res.body);
          var expected = 'cartodb_id,address\r\n1,"Calle de Pérez Galdós 9, Madrid, Spain"\r\n';
          assert.equal(res.body, expected);
          if ( ! --waiting ) done();
      });

    }
});

});
