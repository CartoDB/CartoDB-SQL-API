require('../../helper');
require('../../support/assert');


var app    = require(global.settings.app_root + '/app/controllers/app')
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
            assert.ok(row0.indexOf('SimpleField name="'+ f + '"') != -1, "result does not include '" + f + "'");
          } else {
            assert.ok(row0.indexOf('SimpleField name="'+ f + '"') == -1, "result includes '" + f + "'");
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
            assert.ok(row0.indexOf('SimpleField name="'+ f + '"') != -1, "result does not include '" + f + "'");
          } else {
            assert.ok(row0.indexOf('SimpleField name="'+ f + '"') == -1, "result includes '" + f + "'");
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
        q: "SELECT 'val', x, y, st_makepoint(x,y,4326) as the_geom FROM generate_series(-180, 180) as x, generate_series(-90,90) y",
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
        var body = '<?xml version="1.0" encoding="utf-8" ?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder><name>sql_statement</name></Folder></Document></kml>';
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
        var body = '<?xml version="1.0" encoding="utf-8" ?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder><name>sql_statement</name></Folder></Document></kml>';
        assert.equal(res.body.replace(/\n/g,''), body);
        done();
    });
});

});
