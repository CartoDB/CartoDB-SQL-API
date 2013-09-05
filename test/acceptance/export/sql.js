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

suite('export.sql', function() {

var expected_cache_control = 'no-cache,max-age=3600,must-revalidate,public';
var expected_cache_control_persist = 'public,max-age=31536000';

var hasAttribute = function(sql, att) {

  var re = new RegExp(att);
  if ( sql.match(re) ) return true;
  return false;
}

// SQL tests

test('SQL format, unauthenticated', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=sql',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'SQL is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.sql/gi.test(cd), 'Unexpected SQL filename: ' + cd);
        var row0 = res.body;
        var checkfields = {'name':1, 'address':1, 'cartodb_id':1, 'the_geom':0, 'the_geom_webmercator':0};
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

test('SQL format, unauthenticated, POST', function(done){
    assert.response(app, {
        url: '/api/v1/sql',
        data: 'q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=sql',
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'SQL is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.sql/gi.test(cd), 'Unexpected SQL filename: ' + cd);
        done();
    });
});

test('SQL format, bigger than 81920 bytes', function(done){
    assert.response(app, {
        url: '/api/v1/sql',
        data: querystring.stringify({
          q: 'SELECT 0 as fname FROM generate_series(0,81920)',
          format: 'sql'
        }),
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'SQL is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.sql/gi.test(cd), 'Unexpected SQL filename: ' + cd);
        assert.ok(res.body.length > 81920, 'SQL smaller than expected: ' + res.body.length);
        assert.ok(res.body.match('CREATE TABLE "public"."sql_statement"'));
        assert.ok(res.body.match('INSERT'));
        done();
    });
});

test('SQL format, skipfields', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=sql&skipfields=address,cartodb_id',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'SQL is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.sql/gi.test(cd), 'Unexpected SQL filename: ' + cd);
        var row0 = res.body;
        var checkfields = {'name':1, 'address':0, 'cartodb_id':0, 'the_geom':0, 'the_geom_webmercator':0};
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

test('SQL format, unauthenticated, custom filename', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=sql&filename=sqltest',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'SQL is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=sqltest.sql/gi.test(cd), 'Unexpected SQL filename: ' + cd);
        done();
    });
});

test('SQL format, authenticated', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=sql&api_key=1234',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /filename=cartodb-query.sql/gi.test(cd), 'Unexpected SQL filename: ' + cd);
        done();
    });
});

test('SQL format, unauthenticated, concurrent requests', function(done){
    var query = querystring.stringify({
        q: "SELECT 'val', x, y, st_makepoint(x,y,4326) as the_geom FROM generate_series(-180, 180) as x, generate_series(-90,90) y",
        format: 'sql',
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
              assert.equal(true, /^attachment/.test(cd), 'SQL is not disposed as attachment: ' + cd);
              assert.equal(true, /filename=multi.sql/gi.test(cd), 'Unexpected SQL filename: ' + cd);
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
test('GET /api/v1/sql as sql with no rows', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20true%20WHERE%20false&format=sql',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        assert.ok(res.body.match('CREATE TABLE "public"."sql_statement"'));
        assert.ok(!res.body.match('INSERT'));
        done();
    });
});

// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/90
test('GET /api/v1/sql as sql with ending semicolon', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: 'SELECT true WHERE false;',
          format: 'sql'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        assert.ok(res.body.match('CREATE TABLE "public"."sql_statement"'));
        assert.ok(!res.body.match('INSERT'));
        done();
    });
});

});
