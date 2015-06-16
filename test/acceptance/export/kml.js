require('../../helper');

var app = require(global.settings.app_root + '/app/controllers/app')();
var assert = require('../../support/assert');
var querystring = require('querystring');
var libxmljs = require('libxmljs');
var http = require('http');
var server_utils = require('../../support/server_utils');

// allow lots of emitters to be set to silence warning
app.setMaxListeners(0);

describe('export.kml', function() {

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
  if ( doc.get(xpath) ) {
      return true;
  }

  xpath = "//Placemark/" + att;
  if ( doc.get(xpath) ) {
      return true;
  }

  var lcatt = att.toLowerCase();
  if ( lcatt === 'name' || lcatt === 'description' ) {
    xpath = "//Placemark/" + lcatt;
    if ( doc.get(xpath) ) {
        return true;
    }
  }

  //if ( lowerkml.indexOf('simplefield name="'+ loweratt + '"') != -1 ) return true;
  //if ( lowerkml.indexOf('<'+loweratt+'>') != -1 ) return true;
  return false;
};

// Return the first coordinate array found in KML
var extractCoordinates = function(kml) {

  // Strip namespace:
  //https://github.com/polotek/libxmljs/issues/212
  kml = kml.replace(/ xmlns=[^>]*>/, '>');

  var doc = libxmljs.parseXmlString(kml);
  //console.log("doc: " + doc);
  if ( ! doc ) {
      return;
  }
  var coo = doc.get("//coordinates");
  //console.log("coo: " + coo);
  if ( ! coo ) {
      return;
  }
  coo = coo.text();
  //console.log("coo: " + coo);
  if ( ! coo ) {
      return;
  }
  coo = coo.split(' ');
  //console.log("coo: " + coo);
  for (var i=0; i<coo.length; ++i) {
    coo[i] = coo[i].split(',');
  }

  return coo;
};

// Return the first folder name in KML
var extractFolderName = function(kml) {

  // Strip namespace:
  //https://github.com/polotek/libxmljs/issues/212
  kml = kml.replace(/ xmlns=[^>]*>/, '>');

  var doc = libxmljs.parseXmlString(kml);
  //console.log("doc: " + doc);
  if ( ! doc ) {
      return;
  }
  var coo = doc.get("//Document/Folder/name");
  //console.log("coo: " + coo);
  if ( ! coo ) {
      return;
  }
  coo = coo.text();
  //console.log("coo: " + coo);
  if ( ! coo ) {
      return;
  }
  return coo;
};

// KML tests

it('KML format, unauthenticated', function(done){
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
        Object.keys(checkfields).forEach(function(f) {
          if ( checkfields[f] ) {
            assert.ok(hasAttribute(row0, f), "result does not include '" + f + "': " + row0);
          } else {
            assert.ok(!hasAttribute(row0, f), "result includes '" + f + "'");
          }
        });
        done();
    });
});

it('KML format, unauthenticated, POST', function(done){
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

it('KML format, bigger than 81920 bytes', function(done){
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

it('KML format, skipfields', function(done){
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
        var checkFields = {'Name':1, 'address':0, 'cartodb_id':0, 'the_geom':0, 'the_geom_webmercator':0};
        Object.keys(checkFields).forEach(function(f) {
          if ( checkFields[f] ) {
            assert.ok(hasAttribute(row0, f), "result does not include '" + f + "': " + row0);
          } else {
            assert.ok(!hasAttribute(row0, f), "result includes '" + f + "'");
          }
        });
        done();
    });
});

it('KML format, unauthenticated, custom filename', function(done){
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

it('KML format, authenticated', function(done){
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

it('KML format, unauthenticated, concurrent requests', function(done){
    var query = querystring.stringify({
        q: "SELECT 'val', x, y, st_setsrid(st_makepoint(x,y),4326) as the_geom " +
            "FROM generate_series(-180, 180) as x, generate_series(-90,90) y",
        format: 'kml',
        filename: 'multi'
      });

    var concurrency = 4;
    var waiting = concurrency;

    function onResponse(res) {
        //console.log("Response started");
        res.body = '';
        //res.setEncoding('binary');
        res.on('data', function(chunk){ res.body += chunk; });
        res.on('end', function(){
            //console.log("Response ended");
            assert.equal(res.statusCode, 200, res.body);
            assert.ok(res.body);
            var snippet = res.body.substr(0, 5);
            assert.equal(snippet, "<?xml");
            var cd = res.headers['content-disposition'];
            assert.equal(true, /^attachment/.test(cd), 'KML is not disposed as attachment: ' + cd);
            assert.equal(true, /filename=multi.kml/gi.test(cd), 'Unexpected KML filename: ' + cd);
            if ( ! --waiting ) {
                app.close();
                done();
            }
        });
    }

    function onError(err) {
        console.log("Response error" + err);
    }

    server_utils.startOnNextPort(app, function() { 
      var port = app.address().port;
      //console.log("Listening on port " + port);
      for (var i=0; i<concurrency; ++i) {
        //console.log("Sending request");
        http.request({
            host: 'localhost',
            port: port,
            path: '/api/v1/sql?' + query,
            headers: {host: 'vizzuality.cartodb.com'},
            agent: false // or should this be true ?
        })
            .on('response', onResponse)
            .on('error', onError)
            .end();
      }
    });
});

// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/60
it('GET /api/v1/sql as kml with no rows', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20true%20WHERE%20false&format=kml',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        // NOTE: GDAL-1.11+ added 'id="root_doc"' attribute to the output
        var pat = new RegExp('^<\\?xml version="1.0" encoding="utf-8" \\?>' +
            '<kml xmlns="http://www.opengis.net/kml/2.2">' +
            '<Document( id="root_doc")?><Folder><name>cartodb_query</name></Folder></Document>' +
            '</kml>$');
        var body = res.body.replace(/\n/g,'');
        assert.ok(body.match(pat),
          "Response:\n" + body + '\ndoes not match pattern:\n' + pat);
        done();
    });
});

// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/90
it('GET /api/v1/sql as kml with ending semicolon', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: 'SELECT true WHERE false;',
          format: 'kml'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        // NOTE: GDAL-1.11+ added 'id="root_doc"' attribute to the output
        var pat = new RegExp('^<\\?xml version="1.0" encoding="utf-8" \\?>' +
            '<kml xmlns="http://www.opengis.net/kml/2.2">' +
            '<Document( id="root_doc")?><Folder><name>cartodb_query</name></Folder></Document>' +
            '</kml>$');
        var body = res.body.replace(/\n/g,'');
        assert.ok(body.match(pat),
          "Response:\n" + body + '\ndoes not match pattern:\n' + pat);
        done();
    });
});

// See https://github.com/CartoDB/cartodb/issues/276
it('check point coordinates, unauthenticated', function(done){
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
it('check point coordinates, authenticated', function(done){
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


    var limit = 1200;

    it('expects ' + limit + ' placemarks in public table', function(done){

        assert.response(app, {
                url: '/api/v1/sql',
                data: querystring.stringify({
                    q: "SELECT * from populated_places_simple_reduced limit " + limit,
                    format: 'kml'
                }),
                headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'POST'
            },
            {
                status: 200
            },
            function(res) {
                assert.equal(res.body.match(/<Placemark>/g).length, limit);
                done();
            }
        );
    });

    it('expects ' + limit + ' placemarks in private table using the API KEY', function(done){

        assert.response(app, {
                url: '/api/v1/sql?' + querystring.stringify({
                    q: "SELECT * from populated_places_simple_reduced limit " + limit,
                    api_key: 1234,
                    format: 'kml'
                }),
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'GET'
            },
            {
                status: 200
            },
            function(res) {
                assert.equal(res.body.match(/<Placemark>/g).length, limit);
                done();
            }
        );
    });

});
