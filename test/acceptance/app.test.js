/**
 *
 * Requires the database and tables setup in config/environments/test.js to exist
 * Ensure the user is present in the pgbouncer auth file too
 * TODO: Add OAuth tests.
 *
 * To run this test, ensure that cartodb_test_user_1_db metadata exists in Redis for the vizziality.cartodb.com domain
 *
 * SELECT 5
 * HSET rails:users:vizzuality id 1
 * HSET rails:users:vizzuality database_name cartodb_dev_user_1_db
 *
 */
require('../helper');
require('../support/assert');


var app    = require(global.settings.app_root + '/app/controllers/app')
    , assert = require('assert')
    , querystring = require('querystring')
    , _ = require('underscore')
    , zipfile = require('zipfile')
    , fs      = require('fs')
    , libxmljs = require('libxmljs')
    ;

// allow lots of emitters to be set to silence warning
app.setMaxListeners(0);

suite('app.test', function() {

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

test('GET /api/v1/sql', function(done){
    assert.response(app, {
        url: '/api/v1/sql',
        method: 'GET'
    },{
        status: 400
    }, function(res) {
        assert.deepEqual(JSON.parse(res.body), {"error":["You must indicate a sql query"]});
        done();
    });
});


test('GET /api/v1/sql with SQL parameter on SELECT only. No oAuth included ', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&database=cartodb_test_user_1_db',
        method: 'GET'
    },{ }, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        // Check cache headers
        // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
        assert.equal(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:untitle_table_4');
        assert.equal(res.headers['cache-control'], expected_cache_control);
        done();
    });
});

test('cache_policy=persist', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&database=cartodb_test_user_1_db&cache_policy=persist',
        method: 'GET'
    },{ }, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        // Check cache headers
        // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
        assert.equal(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:untitle_table_4');
        assert.equal(res.headers['cache-control'], expected_cache_control_persist);
        done();
    });
});

test('GET /api/v1/sql with SQL parameter on SELECT only. no database param, just id using headers', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        done();
    });
});

test('GET /api/v1/sql with SQL parameter on SELECT only. no database param, just id using headers. Authenticated.',
function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20cartodb_id*2%20FROM%20untitle_table_4&api_key=1234',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        // Check cache headers
        // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
        assert.equal(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:untitle_table_4');
        assert.equal(res.headers['cache-control'], expected_cache_control);
        done();
    });
});


test('POST /api/v1/sql with SQL parameter on SELECT only. no database param, just id using headers', function(done){
    assert.response(app, {
        url: '/api/v1/sql',
        data: querystring.stringify({q: "SELECT * FROM untitle_table_4"}),
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{ }, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        done();
    });
});

test('GET /api/v1/sql with SQL parameter on INSERT only. oAuth not used, so public user - should fail', function(){
    assert.response(app, {
        url: "/api/v1/sql?q=INSERT%20INTO%20untitle_table_4%20(id)%20VALUES%20(1)&database=cartodb_dev_user_1_db",
        method: 'GET'
    },{
        status: 400
    });
});

test('GET /api/v1/sql with SQL parameter on DROP DATABASE only. oAuth not used, so public user - should fail', function(){
    assert.response(app, {
        url: "/api/v1/sql?q=DROP%20TABLE%20untitle_table_4&database=cartodb_dev_user_1_db",
        method: 'GET'
    },{
        status: 400
    });
});

test('GET /api/v1/sql with SQL parameter on INSERT only. header based db - should fail', function(){
    assert.response(app, {
        url: "/api/v1/sql?q=INSERT%20INTO%20untitle_table_4%20(id)%20VALUES%20(1)",
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 400
    });
});

// Check results from INSERT 
//
// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/13
test('INSERT returns affected rows', function(done){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=1234&"
         + querystring.stringify({q:
          "INSERT INTO private_table(name) VALUES('noret1') UNION VALUES('noret2')"
        }),
        headers: {host: 'vizzuality.localhost.lan:8080' },
        method: 'GET'
    },{}, function(res) {
        assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
        var out = JSON.parse(res.body);
        assert.ok(out.hasOwnProperty('time'));
        assert.equal(out.total_rows, 2);
        assert.equal(out.rows.length, 0);
        // Check cache headers
        // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
        assert.equal(res.headers['x-cache-channel'], 'NONE');
        assert.equal(res.headers['cache-control'], expected_cache_control);
        done();
    });
});

// Check results from UPDATE
//
// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/13
test('UPDATE returns affected rows', function(done){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=1234&"
         + querystring.stringify({q:
          "UPDATE private_table SET name = upper(name) WHERE name in ('noret1', 'noret2')"
        }),
        headers: {host: 'vizzuality.localhost.lan:8080' },
        method: 'GET'
    },{}, function(res) {
        assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
        var out = JSON.parse(res.body);
        assert.ok(out.hasOwnProperty('time'));
        assert.equal(out.total_rows, 2);
        assert.equal(out.rows.length, 0);
        // Check cache headers
        // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
        assert.equal(res.headers['x-cache-channel'], 'NONE');
        assert.equal(res.headers['cache-control'], expected_cache_control);
        done();
    });
});

// Check results from DELETE
//
// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/13
test('DELETE returns affected rows', function(done){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=1234&"
         + querystring.stringify({q:
          "DELETE FROM private_table WHERE name in ('NORET1', 'NORET2')"
        }),
        headers: {host: 'vizzuality.localhost.lan:8080' },
        method: 'GET'
    },{}, function(res) {
        assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
        var out = JSON.parse(res.body);
        assert.ok(out.hasOwnProperty('time'));
        assert.equal(out.total_rows, 2);
        assert.equal(out.rows.length, 0);
        // Check cache headers
        // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
        assert.equal(res.headers['x-cache-channel'], 'NONE');
        assert.equal(res.headers['cache-control'], expected_cache_control);
        done();
    });
});

// Check results from INSERT .. RETURNING
//
// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/50
test('INSERT with RETURNING returns all results', function(done){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=1234&"
         + querystring.stringify({q:
          "INSERT INTO private_table(name) VALUES('test') RETURNING upper(name), reverse(name)"
        }),
        headers: {host: 'vizzuality.localhost.lan:8080' },
        method: 'GET'
    },{}, function(res) {
        assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
        var out = JSON.parse(res.body);
        assert.ok(out.hasOwnProperty('time'));
        assert.equal(out.total_rows, 1);
        assert.equal(out.rows.length, 1);
        assert.equal(_.keys(out.rows[0]).length, 2);
        assert.equal(out.rows[0].upper, 'TEST');
        assert.equal(out.rows[0].reverse, 'tset');
        done();
    });
});

// Check results from UPDATE .. RETURNING
//
// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/50
test('UPDATE with RETURNING returns all results', function(done){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=1234&"
         + querystring.stringify({q:
          "UPDATE private_table SET name = 'tost' WHERE name = 'test' RETURNING upper(name), reverse(name)"
        }),
        headers: {host: 'vizzuality.localhost.lan:8080' },
        method: 'GET'
    },{}, function(res) {
        assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
        var out = JSON.parse(res.body);
        assert.ok(out.hasOwnProperty('time'));
        assert.equal(out.total_rows, 1);
        assert.equal(out.rows.length, 1);
        assert.equal(_.keys(out.rows[0]).length, 2);
        assert.equal(out.rows[0].upper, 'TOST');
        assert.equal(out.rows[0].reverse, 'tsot');
        done();
    });
});

// Check results from DELETE .. RETURNING
//
// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/50
test('DELETE with RETURNING returns all results', function(done){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=1234&"
         + querystring.stringify({q:
          "DELETE FROM private_table WHERE name = 'tost' RETURNING name"
        }),
        headers: {host: 'vizzuality.localhost.lan:8080' },
        method: 'GET'
    },{}, function(res) {
        assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
        var out = JSON.parse(res.body);
        assert.ok(out.hasOwnProperty('time'));
        assert.equal(out.total_rows, 1);
        assert.equal(out.rows.length, 1);
        assert.equal(_.keys(out.rows[0]).length, 1);
        assert.equal(out.rows[0].name, 'tost');
        done();
    });
});

test('GET /api/v1/sql with SQL parameter on DROP DATABASE only.header based db - should fail', function(){
    assert.response(app, {
        url: "/api/v1/sql?q=DROP%20TABLE%20untitle_table_4",
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 400
    });
});

test('CREATE TABLE with GET and auth', function(done){
    assert.response(app, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'CREATE TABLE test_table(a int)',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      // Check cache headers
      // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
      assert.equal(res.headers['x-cache-channel'], 'NONE');
      assert.equal(res.headers['cache-control'], expected_cache_control);
      done();
    });
});

// TODO: test COPY
//test('COPY TABLE with GET and auth', function(done){
//    assert.response(app, {
//        url: "/api/v1/sql?" + querystring.stringify({
//          q: 'COPY TABLE test_table FROM stdin; 1\n\\.\n',
//          api_key: 1234
//        }),
//        headers: {host: 'vizzuality.cartodb.com'},
//        method: 'GET'
//    },{}, function(res) {
//      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
//      // Check cache headers
//      // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
//      assert.equal(res.headers['x-cache-channel'], 'NONE');
//      assert.equal(res.headers['cache-control'], expected_cache_control);
//      done();
//    });
//});

test('ALTER TABLE with GET and auth', function(done){
    assert.response(app, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'ALTER TABLE test_table ADD b int',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      // Check cache headers
      // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
      assert.equal(res.headers['x-cache-channel'], 'NONE');
      assert.equal(res.headers['cache-control'], expected_cache_control);
      done();
    });
});

test('DROP TABLE with GET and auth', function(done){
    assert.response(app, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'DROP TABLE test_table',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      // Check cache headers
      // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
      assert.equal(res.headers['x-cache-channel'], 'NONE');
      assert.equal(res.headers['cache-control'], expected_cache_control);
      done();
    });
});

test('CREATE FUNCTION with GET and auth', function(done){
    assert.response(app, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'CREATE FUNCTION create_func_test(a int) RETURNS INT AS \'SELECT 1\' LANGUAGE \'sql\'',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      // Check cache headers
      // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
      assert.equal(res.headers['x-cache-channel'], 'NONE');
      assert.equal(res.headers['cache-control'], expected_cache_control);
      done();
    });
});

test('DROP FUNCTION with GET and auth', function(done){
    assert.response(app, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'DROP FUNCTION create_func_test(a int)',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      // Check cache headers
      // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
      assert.equal(res.headers['x-cache-channel'], 'NONE');
      assert.equal(res.headers['cache-control'], expected_cache_control);
      done();
    });
});

test('sends a 400 when an unsupported format is requested', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=unknown',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 400, res.body);
        assert.deepEqual(JSON.parse(res.body), {"error":[ "Invalid format: unknown" ]});
        done();
    });
});

test('GET /api/v1/sql with SQL parameter and no format, ensuring content-disposition set to json', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'JSON is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.json/gi.test(cd), 'Unexpected JSON filename: ' + cd);
        done();
    });
});

test('field named "the_geom_webmercator" is not skipped by default', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var row0 = JSON.parse(res.body).rows[0];
        var checkfields = {'name':1, 'cartodb_id':1, 'the_geom':1, 'the_geom_webmercator':1};
        for ( var f in checkfields ) {
          if ( checkfields[f] ) {
            assert.ok(row0.hasOwnProperty(f), "result does not include '" + f + "'");
          } else {
            assert.ok(!row0.hasOwnProperty(f), "result includes '" + f + "'");
          }
        }
        done();
    });
});

test('skipfields controls included fields', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&skipfields=the_geom_webmercator,cartodb_id,unexistant',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var row0 = JSON.parse(res.body).rows[0];
        var checkfields = {'name':1, 'cartodb_id':0, 'the_geom':1, 'the_geom_webmercator':0};
        for ( var f in checkfields ) {
          if ( checkfields[f] ) {
            assert.ok(row0.hasOwnProperty(f), "result does not include '" + f + "'");
          } else {
            assert.ok(!row0.hasOwnProperty(f), "result includes '" + f + "'");
          }
        }
        done();
    });
});

test('GET /api/v1/sql ensure cross domain set on errors', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*gadfgadfg%20FROM%20untitle_table_4',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 400
    }, function(res){
        var cd = res.header('Access-Control-Allow-Origin');
        assert.equal(cd, '*');
        done();
    });
});

test('cannot GET system tables', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20pg_attribute',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 403
    }, function() { done(); });
});

test('GET decent error if domain is incorrect', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson',
        headers: {host: 'vizzualinot.cartodb.com'},
        method: 'GET'
    },{
        status: 404
    }, function(res){
        var result = JSON.parse(res.body);
        assert.equal(result.error[0],"Sorry, we can't find this CartoDB. Please check that you have entered the correct domain.");
        done();
    });
});

test('GET decent error if SQL is broken', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({q:
          'SELECT star FROM this and that'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(res){
        assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
        var result = JSON.parse(res.body);
        // NOTE: actual error message may be slighly different, possibly worth a regexp here
        assert.equal(result.error[0], 'syntax error at or near "and"');
        done();
    });
});

// GEOJSON tests

test('GET /api/v1/sql with SQL parameter and geojson format, ensuring content-disposition set to geojson', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'GEOJSON is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.geojson/gi.test(cd));
        done();
    });
});

test('uses the last format parameter when multiple are used', function(done){
    assert.response(app, {
        url: '/api/v1/sql?format=csv&q=SELECT%20*%20FROM%20untitle_table_4&format=geojson',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /filename=cartodb-query.geojson/gi.test(cd));
        done();
    });
});

test('uses custom filename', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson&filename=x',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /filename=x.geojson/gi.test(cd), cd);
        done();
    });
});

test('does not include the_geom and the_geom_webmercator properties by default', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var parsed_body = JSON.parse(res.body);
        var row0 = parsed_body.features[0].properties;
        var checkfields = {'name':1, 'cartodb_id':1, 'the_geom':0, 'the_geom_webmercator':0};
        for ( var f in checkfields ) {
          if ( checkfields[f] ) {
            assert.ok(row0.hasOwnProperty(f), "result does not include '" + f + "'");
          } else {
            assert.ok(!row0.hasOwnProperty(f), "result includes '" + f + "'");
          }
        }
        done();
    });
});

test('skipfields controls fields included in GeoJSON output', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson&skipfields=unexistant,cartodb_id',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var parsed_body = JSON.parse(res.body);
        var row0 = parsed_body.features[0].properties;
        var checkfields = {'name':1, 'cartodb_id':0, 'the_geom':0, 'the_geom_webmercator':0};
        for ( var f in checkfields ) {
          if ( checkfields[f] ) {
            assert.ok(row0.hasOwnProperty(f), "result does not include '" + f + "'");
          } else {
            assert.ok(!row0.hasOwnProperty(f), "result includes '" + f + "'");
          }
        }
        done();
    });
});


test('GET /api/v1/sql as geojson limiting decimal places', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: 'SELECT ST_MakePoint(0.123,2.3456) as the_geom',
          format: 'geojson',
          dp: '1'}),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var result = JSON.parse(res.body);
        assert.equal(1, checkDecimals(result.features[0].geometry.coordinates[0], '.'));
        done();
    });
});

test('GET /api/v1/sql as geojson with default dp as 6', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: 'SELECT ST_MakePoint(0.12345678,2.3456787654) as the_geom',
          format: 'geojson'}),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var result = JSON.parse(res.body);
        assert.equal(6, checkDecimals(result.features[0].geometry.coordinates[0], '.'));
        done();
    });
});


// CSV tests

test('CSV format', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=csv',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
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
        var body = "cartodb_id,geom\r\n1,SRID=4326;POINT(-3.699732 40.423012)";
        assert.equal(body, res.body);
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
        var body = "";
        assert.equal(body, res.body);
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
        var body = 'cartodb_id,address\r\n1,"Calle de Pérez Galdós 9, Madrid, Spain"';
        assert.equal(body, res.body);
        done();
    });
});

// SVG tests

test('GET /api/v1/sql with SVG format', function(done){
    var query = querystring.stringify({
      q: "SELECT 1 as cartodb_id, ST_MakeLine(ST_MakePoint(10, 10), ST_MakePoint(1034, 778)) AS the_geom ",
      format: "svg"
    });
    assert.response(app, {
        url: '/api/v1/sql?' + query,
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.ok(/filename=cartodb-query.svg/gi.test(cd), cd);
        assert.equal(res.header('Content-Type'), 'image/svg+xml; charset=utf-8');
        assert.ok( res.body.indexOf('<path d="M 0 768 L 1024 0" />') > 0, res.body );
        // TODO: test viewBox
        done();
    });
});

test('GET /api/v1/sql with SVG format and custom filename', function(done){
    var query = querystring.stringify({
      q: "SELECT 1 as cartodb_id, ST_MakeLine(ST_MakePoint(10, 10), ST_MakePoint(1034, 778)) AS the_geom ",
      format: "svg",
      filename: 'mysvg'
    });
    assert.response(app, {
        url: '/api/v1/sql?' + query,
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.ok(/filename=mysvg.svg/gi.test(cd), cd);
        assert.equal(res.header('Content-Type'), 'image/svg+xml; charset=utf-8');
        assert.ok( res.body.indexOf('<path d="M 0 768 L 1024 0" />') > 0, res.body );
        // TODO: test viewBox
        done();
    });
});

test('GET /api/v1/sql with SVG format and centered point', function(done){
    var query = querystring.stringify({
      q: "SELECT 1 as cartodb_id, ST_MakePoint(5000, -54) AS the_geom ",
      format: "svg"
    });
    assert.response(app, {
        url: '/api/v1/sql?' + query,
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.ok(/filename=cartodb-query.svg/gi.test(cd), cd);
        assert.equal(res.header('Content-Type'), 'image/svg+xml; charset=utf-8');
        assert.ok( res.body.indexOf('cx="0" cy="0"') > 0, res.body );
        // TODO: test viewBox
        // TODO: test radius
        done();
    });
});

test('GET /api/v1/sql with SVG format and trimmed decimals', function(done){
    var queryobj = {
      q: "SELECT 1 as cartodb_id, 'LINESTRING(0 0, 1024 768, 500.123456 600.98765432)'::geometry AS the_geom ",
      format: "svg",
      dp: 2
    };
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify(queryobj),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.ok(/filename=cartodb-query.svg/gi.test(cd), cd);
        assert.equal(res.header('Content-Type'), 'image/svg+xml; charset=utf-8');
        assert.ok( res.body.indexOf('<path d="M 0 768 L 1024 0 500.12 167.01" />') > 0, res.body );
        // TODO: test viewBox

        queryobj.dp = 3;
        assert.response(app, {
          url: '/api/v1/sql?' + querystring.stringify(queryobj),
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
        },{}, function(res) {
          assert.equal(res.statusCode, 200, res.body);
          var cd = res.header('Content-Disposition');
          assert.equal(true, /^attachment/.test(cd), 'SVG is not disposed as attachment: ' + cd);
          assert.ok(/filename=cartodb-query.svg/gi.test(cd), cd);
          assert.equal(res.header('Content-Type'), 'image/svg+xml; charset=utf-8');
          assert.ok( res.body.indexOf('<path d="M 0 768 L 1024 0 500.123 167.012" />') > 0, res.body );
          // TODO: test viewBox
          done();
        });
    });
});


// SHP tests

test('SHP format, unauthenticated', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=shp',
        headers: {host: 'vizzuality.cartodb.com'},
        encoding: 'binary',
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'SHP is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.zip/gi.test(cd));
        var tmpfile = '/tmp/myshape.zip';
        var err = fs.writeFileSync(tmpfile, res.body, 'binary');
        if (err) { done(err); return }
        var zf = new zipfile.ZipFile(tmpfile);
        assert.ok(_.contains(zf.names, 'cartodb-query.shp'), 'SHP zipfile does not contain .shp: ' + zf.names);
        assert.ok(_.contains(zf.names, 'cartodb-query.shx'), 'SHP zipfile does not contain .shx: ' + zf.names);
        assert.ok(_.contains(zf.names, 'cartodb-query.dbf'), 'SHP zipfile does not contain .dbf: ' + zf.names);
        // missing SRID, so no PRJ (TODO: add ?)
        //assert.ok(_.contains(zf.names, 'cartodb-query.prj'), 'SHP zipfile does not contain .prj: ' + zf.names);
        // TODO: check DBF contents
        fs.unlinkSync(tmpfile);
        done();
    });
});

test('SHP format, unauthenticated, with custom filename', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=shp&filename=myshape',
        headers: {host: 'vizzuality.cartodb.com'},
        encoding: 'binary',
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'SHP is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=myshape.zip/gi.test(cd));
        var tmpfile = '/tmp/myshape.zip';
        var err = fs.writeFileSync(tmpfile, res.body, 'binary');
        if (err) { done(err); return }
        var zf = new zipfile.ZipFile(tmpfile);
        assert.ok(_.contains(zf.names, 'myshape.shp'), 'SHP zipfile does not contain .shp: ' + zf.names);
        assert.ok(_.contains(zf.names, 'myshape.shx'), 'SHP zipfile does not contain .shx: ' + zf.names);
        assert.ok(_.contains(zf.names, 'myshape.dbf'), 'SHP zipfile does not contain .dbf: ' + zf.names);
        // missing SRID, so no PRJ (TODO: add ?)
        //assert.ok(_.contains(zf.names, 'myshape.prj'), 'SHP zipfile does not contain .prj: ' + zf.names);
        fs.unlinkSync(tmpfile);
        done();
    });
});

test('SHP format, unauthenticated, with custom, dangerous filename', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=shp&filename=b;"%20()[]a',
        headers: {host: 'vizzuality.cartodb.com'},
        encoding: 'binary',
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var fname = "b_______a";
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'SHP is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=b_______a.zip/gi.test(cd), 'Unexpected SHP filename: ' + cd);
        var tmpfile = '/tmp/myshape.zip';
        var err = fs.writeFileSync(tmpfile, res.body, 'binary');
        if (err) { done(err); return }
        var zf = new zipfile.ZipFile(tmpfile);
        assert.ok(_.contains(zf.names, fname + '.shp'), 'SHP zipfile does not contain .shp: ' + zf.names);
        assert.ok(_.contains(zf.names, fname + '.shx'), 'SHP zipfile does not contain .shx: ' + zf.names);
        assert.ok(_.contains(zf.names, fname + '.dbf'), 'SHP zipfile does not contain .dbf: ' + zf.names);
        // missing SRID, so no PRJ (TODO: add ?)
        //assert.ok(_.contains(zf.names, fname+ '.prj'), 'SHP zipfile does not contain .prj: ' + zf.names);
        fs.unlinkSync(tmpfile);
        done();
    });
});

test('SHP format, authenticated', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=shp&api_key=1234',
        headers: {host: 'vizzuality.cartodb.com'},
        encoding: 'binary',
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /filename=cartodb-query.zip/gi.test(cd));
        var tmpfile = '/tmp/myshape.zip';
        var err = fs.writeFileSync(tmpfile, res.body, 'binary');
        if (err) { done(err); return }
        var zf = new zipfile.ZipFile(tmpfile);
        assert.ok(_.contains(zf.names, 'cartodb-query.shp'), 'SHP zipfile does not contain .shp: ' + zf.names);
        assert.ok(_.contains(zf.names, 'cartodb-query.shx'), 'SHP zipfile does not contain .shx: ' + zf.names);
        assert.ok(_.contains(zf.names, 'cartodb-query.dbf'), 'SHP zipfile does not contain .dbf: ' + zf.names);
        // missing SRID, so no PRJ (TODO: add ?)
        //assert.ok(_.contains(zf.names, 'cartodb-query.prj'), 'SHP zipfile does not contain .prj: ' + zf.names);
        // TODO: check contents of the DBF
        fs.unlinkSync(tmpfile);
        done();
    });
});

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
            assert.ok(row0.indexOf('SimpleData name="'+ f + '"') != -1, "result does not include '" + f + "'");
          } else {
            assert.ok(row0.indexOf('SimpleData name="'+ f + '"') == -1, "result includes '" + f + "'");
          }
        }
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
            assert.ok(row0.indexOf('SimpleData name="'+ f + '"') != -1, "result does not include '" + f + "'");
          } else {
            assert.ok(row0.indexOf('SimpleData name="'+ f + '"') == -1, "result includes '" + f + "'");
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
        // TODO: check for actual content, at least try to uncompress..
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
        // TODO: check for actual content, at least try to uncompress..
        done();
    });
});

/**
 * CORS
 */
test('GET /api/v1/sql with SQL parameter on SELECT only should return CORS headers ', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&database=cartodb_test_user_1_db',
        method: 'GET'
    },{ }, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        // Check cache headers
        // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
        assert.equal(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:untitle_table_4');
        assert.equal(res.headers['cache-control'], expected_cache_control);
        assert.equal(res.headers['access-control-allow-origin'], '*');
        assert.equal(res.headers['access-control-allow-headers'], "X-Requested-With, X-Prototype-Version, X-CSRF-Token");
        done();
    });
});

test('OPTIONS /api/v1/sql with SQL parameter on SELECT only should return CORS headers ', function(done){
    assert.response(app, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&database=cartodb_test_user_1_db',
        method: 'OPTIONS'
    },{ }, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        // Check cache headers
        // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
        assert.equal(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:untitle_table_4');
        assert.equal(res.headers['cache-control'], expected_cache_control);
        assert.equal(res.headers['access-control-allow-origin'], '*');
        assert.equal(res.headers['access-control-allow-headers'], "X-Requested-With, X-Prototype-Version, X-CSRF-Token");
        done();
    });
});


});
