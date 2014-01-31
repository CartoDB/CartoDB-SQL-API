require('../../helper');
require('../../support/assert');


var app    = require(global.settings.app_root + '/app/controllers/app')()
    , assert = require('assert')
    , querystring = require('querystring')
    , _ = require('underscore')
    , zipfile = require('zipfile')
    , fs      = require('fs')
    , libxmljs = require('libxmljs')
    , http = require('http')
    , server_utils = require('../../support/server_utils');
    ;

// allow lots of emitters to be set to silence warning
app.setMaxListeners(0);

suite('export.kml', function() {

var expected_cache_control = 'no-cache,max-age=3600,must-revalidate,public';
var expected_cache_control_persist = 'public,max-age=31536000';

// use dec_sep for internationalization
var checkDecimals = function(x, dec_sep){
    var tmp='' + x;
    if (tmp.indexOf(dec_sep)>-1)
        return tmp.length-tmp.indexOf(dec_sep)-1;
    else
        return 0;
}

// Check if an attribute is in the KML output
//
// NOTE: "name" and "description" attributes are threated specially
//       in that they are matched in case-insensitive way
//
var hasAttribute = function(kml, att) {

  // Strip namespace:
  //https://github.com/polotek/libxmljs/issues/212
  kml = kml.replace(/ xmlns=[^>]*>/, '>');

  var doc = libxmljs.parseXmlString(kml);
  //console.log("doc: " + doc);
  var xpath;

  xpath = "//SimpleField[@name='" + att + "']";
  if ( doc.get(xpath) ) return true;

  xpath = "//Placemark/" + att;
  if ( doc.get(xpath) ) return true;

  var lcatt = att.toLowerCase();
  if ( lcatt == 'name' || lcatt == 'description' ) {
    xpath = "//Placemark/" + lcatt;
    if ( doc.get(xpath) ) return true;
  }

  //if ( lowerkml.indexOf('simplefield name="'+ loweratt + '"') != -1 ) return true;
  //if ( lowerkml.indexOf('<'+loweratt+'>') != -1 ) return true;
  return false;
}

// Return the first coordinate array found in KML
var extractCoordinates = function(kml) {

  // Strip namespace:
  //https://github.com/polotek/libxmljs/issues/212
  kml = kml.replace(/ xmlns=[^>]*>/, '>');

  var doc = libxmljs.parseXmlString(kml);
  //console.log("doc: " + doc);
  if ( ! doc ) return;
  var coo = doc.get("//coordinates");
  //console.log("coo: " + coo);
  if ( ! coo ) return;
  coo = coo.text();
  //console.log("coo: " + coo);
  if ( ! coo ) return;
  coo = coo.split(' ');
  //console.log("coo: " + coo);
  for (var i=0; i<coo.length; ++i) {
    coo[i] = coo[i].split(',');
  }

  return coo;
}

// Return the first folder name in KML
var extractFolderName = function(kml) {

  // Strip namespace:
  //https://github.com/polotek/libxmljs/issues/212
  kml = kml.replace(/ xmlns=[^>]*>/, '>');

  var doc = libxmljs.parseXmlString(kml);
  //console.log("doc: " + doc);
  if ( ! doc ) return;
  var coo = doc.get("//Document/Folder/name");
  //console.log("coo: " + coo);
  if ( ! coo ) return;
  coo = coo.text();
  //console.log("coo: " + coo);
  if ( ! coo ) return;
  return coo;
}

// KML tests

test('KML format, unauthenticated', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=kml',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'KML is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.kml/gi.test(cd), 'Unexpected KML filename: ' + cd);
        var row0 = res.body;
        var checkfields = {'Name':1, 'address':1, 'cartodb_id':1, 'the_geom':0, 'the_geom_webmercator':0};
        for ( var f in checkfields ) {
          if ( checkfields[f] ) {
            assert.ok(hasAttribute(row0, f), "result does not include '" + f + "': " + row0);
          } else {
            assert.ok(!hasAttribute(row0, f), "result includes '" + f + "'");
          }
        }
        done();
    });
});

test('KML format, unauthenticated, POST', function(done){
    assert.response(app, {
        url: '/api/v1/sql',
        data: 'q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=kml',
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'KML is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.kml/gi.test(cd), 'Unexpected KML filename: ' + cd);
        done();
    });
});

test('KML format, bigger than 81920 bytes', function(done){
    assert.response(app, {
        url: '/api/v1/sql',
        data: querystring.stringify({
          q: 'SELECT 0 as fname FROM generate_series(0,81920)',
          format: 'kml'
        }),
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'KML is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.kml/gi.test(cd), 'Unexpected KML filename: ' + cd);
        assert.ok(res.body.length > 81920, 'KML smaller than expected: ' + res.body.length);
        done();
    });
});

test('KML format, skipfields', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=kml&skipfields=address,cartodb_id',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'KML is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.kml/gi.test(cd), 'Unexpected KML filename: ' + cd);
        var row0 = res.body;
        var checkfields = {'Name':1, 'address':0, 'cartodb_id':0, 'the_geom':0, 'the_geom_webmercator':0};
        for ( var f in checkfields ) {
          if ( checkfields[f] ) {
            assert.ok(hasAttribute(row0, f), "result does not include '" + f + "': " + row0);
          } else {
            assert.ok(!hasAttribute(row0, f), "result includes '" + f + "'");
          }
        }
        done();
    });
});

test('KML format, unauthenticated, custom filename', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=kml&filename=kmltest',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'KML is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=kmltest.kml/gi.test(cd), 'Unexpected KML filename: ' + cd);
        var name = extractFolderName(res.body);
        assert.equal(name, "kmltest");
        done();
    });
});

test('KML format, authenticated', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=kml&api_key=1234',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /filename=cartodb-query.kml/gi.test(cd), 'Unexpected KML filename: ' + cd);
        done();
    });
});

test('KML format, unauthenticated, concurrent requests', function(done){
    var query = querystring.stringify({
        q: "SELECT 'val', x, y, st_setsrid(st_makepoint(x,y),4326) as the_geom FROM generate_series(-180, 180) as x, generate_series(-90,90) y",
        format: 'kml',
        filename: 'multi'
      });

    var concurrency = 4;
    var waiting = concurrency;
    server_utils.startOnNextPort(app, function() { 
      var port = app.address().port;
      //console.log("Listening on port " + port);
      for (var i=0; i<concurrency; ++i) {
        //console.log("Sending request");
        var req = http.request({
            host: '127.0.0.1',
            port: port,
            path: '/api/v1/sql?' + query,
            headers: {host: 'vizzuality.cartodb.com'},
            agent: false // or should this be true ?
        }).on('response', function(res) {
            //console.log("Response started");
            //res.body = '';
            //res.setEncoding('binary');
            //res.on('data', function(chunk){ res.body += chunk; });
            res.on('end', function(){
              //console.log("Response ended");
              assert.equal(res.statusCode, 200, res.body);
              var cd = res.headers['content-disposition'];
              assert.equal(true, /^attachment/.test(cd), 'KML is not disposed as attachment: ' + cd);
              assert.equal(true, /filename=multi.kml/gi.test(cd), 'Unexpected KML filename: ' + cd);
              if ( ! --waiting ) {
                app.close();
                done();
              }
            });
        }).on('error', function(err) {
            console.log("Response error" + err);
        }).end();
      }
    });
});

// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/60
test('GET /api/v1/sql as kml with no rows', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20true%20WHERE%20false&format=kml',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var body = '<?xml version="1.0" encoding="utf-8" ?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder><name>cartodb_query</name></Folder></Document></kml>';
        assert.equal(res.body.replace(/\n/g,''), body);
        done();
    });
});

// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/90
test('GET /api/v1/sql as kml with ending semicolon', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: 'SELECT true WHERE false;',
          format: 'kml'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var body = '<?xml version="1.0" encoding="utf-8" ?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder><name>cartodb_query</name></Folder></Document></kml>';
        assert.equal(res.body.replace(/\n/g,''), body);
        done();
    });
});

// See https://github.com/CartoDB/cartodb/issues/276
test('check point coordinates, unauthenticated', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: 'SELECT * from untitle_table_4 WHERE cartodb_id = -1',
          format: 'kml'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var coords = extractCoordinates(res.body);
        assert(coords, 'No coordinates in ' + res.body);
        assert.deepEqual(coords, [[33,16]]);
        done();
    });
});

// See https://github.com/CartoDB/cartodb/issues/276
test('check point coordinates, authenticated', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: 'SELECT * from untitle_table_4 WHERE cartodb_id = -1',
          api_key: 1234,
          format: 'kml'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var coords = extractCoordinates(res.body);
        assert(coords, 'No coordinates in ' + res.body);
        assert.deepEqual(coords, [[33,16]]);
        done();
    });
});

});
