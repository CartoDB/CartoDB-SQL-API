/**
 *
 * Requires the database and tables setup in config/environments/test.js to exist
 * Ensure the user is present in the pgbouncer auth file too
 * TODO: Add OAuth tests.
 *
 * To run this test, ensure that cartodb_test_user_1_db metadata exists
 * in Redis for the vizzuality.cartodb.com domain
 *
 * SELECT 5
 * HSET rails:users:vizzuality id 1
 * HSET rails:users:vizzuality database_name cartodb_test_user_1_db
 *
 */
require('../helper');

var server = require('../../app/server')();
var assert = require('../support/assert');
var querystring = require('querystring');
var _ = require('underscore');
var step = require('step');


describe('app.test', function() {

    var RESPONSE_OK = {
        statusCode: 200
    };

var expected_cache_control = 'no-cache,max-age=31536000,must-revalidate,public';
var expected_rw_cache_control = 'no-cache,max-age=0,must-revalidate,public';

it('GET /api/v1/sql with SQL parameter on SELECT only. No oAuth included ', function(done){
    assert.response(server, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&database=cartodb_test_user_1_db',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(err, res) {
        assert.equal(res.statusCode, 200, res.body);
        // Check cache headers
        assert.equal(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:public.untitle_table_4');
        assert.equal(res.headers['cache-control'], expected_cache_control);
        done();
    });
});

it('GET /api/v1/sql with SQL parameter on SELECT only. no database param, just id using headers', function(done){
    assert.response(server, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(err, res) {
        assert.equal(res.statusCode, 200, res.body);
        done();
    });
});

it('GET /user/vizzuality/api/v1/sql with SQL parameter on SELECT only', function(done){
    assert.response(server, {
        url: '/user/vizzuality/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4',
        method: 'GET'
    },{ }, function(err, res) {
        assert.equal(res.statusCode, 200, res.body);
        done();
    });
});

it('GET /api/v1/sql with SQL parameter on SELECT only. no database param, just id using headers. Authenticated.',
function(done){
    assert.response(server, {
        url: '/api/v1/sql?q=SELECT%20cartodb_id*2%20FROM%20untitle_table_4&api_key=1234',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(err, res) {
        assert.equal(res.statusCode, 200, res.body);
        // Check cache headers
        assert.equal(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:public.untitle_table_4');
        assert.equal(res.headers['cache-control'], expected_cache_control);
        done();
    });
});

it('should accept a basic parameterized query', function(done){
    assert.response(server, {
        url: '/api/v1/sql?' + querystring.stringify({
            api_key: '1234',
            q: 'SELECT name FROM untitle_table_4 WHERE cartodb_id = $1',
            params: [5]
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    }, {}, function(err, res) {
        assert.equal(res.statusCode, 200, res.body);
        var parsed = JSON.parse(res.body);
        assert.equal(parsed.rows.length, 1);
        assert.equal(parsed.rows[0].name, 'El Pico');
        done();
    });
});

it('should accept a parameterized query with multiple parameters', function(done){
    assert.response(server, {
        url: '/api/v1/sql?' + querystring.stringify({
            api_key: '1234',
            q: 'SELECT name FROM untitle_table_4 WHERE name LIKE $1 AND ST_Intersects(the_geom, ST_GeomFromText($2))',
            params: ['El %', 'SRID=4326;POLYGON((-4 41, -3 41, -3 30, -4 30, -4 41))']
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    }, {}, function(err, res) {
        assert.equal(res.statusCode, 200, res.body);
        var parsed = JSON.parse(res.body);
        assert.equal(parsed.rows.length, 4);
        assert.deepEqual(
            ['El Estocolmo', 'El Rey del Tallarín', 'El Lacón', 'El Pico'],
            _.pluck(parsed.rows, 'name')
        );
        done();
    });
});

it('POST /api/v1/sql with SQL parameter on SELECT only. no database param, just id using headers', function(done){
    assert.response(server, {
        url: '/api/v1/sql',
        data: querystring.stringify({q: "SELECT * FROM untitle_table_4"}),
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{ }, function(err, res) {
        assert.equal(res.statusCode, 200, res.body);
        done();
    });
});

it('GET /api/v1/sql with INSERT. oAuth not used, so public user - should fail', function(done){
    assert.response(server, {
        url: "/api/v1/sql?q=INSERT%20INTO%20untitle_table_4%20(cartodb_id)%20VALUES%20(1e4)" +
            "&database=cartodb_test_user_1_db",
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
    }, function(err, res) {
        assert.equal(res.statusCode, 401, res.statusCode + ': ' + res.body);
        assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
        assert.deepEqual(res.headers['content-disposition'], 'inline');
        assert.deepEqual(JSON.parse(res.body),
          {"error":["permission denied for relation untitle_table_4"]}
        );
        done();
    });
});

it('GET /api/v1/sql with DROP TABLE. oAuth not used, so public user - should fail', function(done){
    assert.response(server, {
        url: "/api/v1/sql?q=DROP%20TABLE%20untitle_table_4&database=cartodb_test_user_1_db",
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
    }, function(err, res) {
        assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
        assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
        assert.deepEqual(res.headers['content-disposition'], 'inline');
        assert.deepEqual(JSON.parse(res.body),
          {"error":["must be owner of relation untitle_table_4"]}
        );
        done();
    });
});

it('GET /api/v1/sql with INSERT. header based db - should fail', function (done) {
    assert.response(server, {
        url: "/api/v1/sql?q=INSERT%20INTO%20untitle_table_4%20(id)%20VALUES%20(1)",
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    }, {
        status: 400
    }, done);
});

it('GET /api/v1/sql with SQL parameter on DROP TABLE. should fail', function(done){
    assert.response(server, {
        url: "/api/v1/sql?q=DROP%20TABLE%20untitle_table_4",
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(err, res) {
        assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
        assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
        assert.deepEqual(res.headers['content-disposition'], 'inline');
        assert.deepEqual(JSON.parse(res.body),
          {"error":["must be owner of relation untitle_table_4"]}
        );
        done();
    });
});

// Check X-Cache-Channel when querying "updated_at" fields
//
// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/99
it('Field name is not confused with UPDATE operation', function(done){
    assert.response(server, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=1234&" + querystring.stringify({q:
          "SELECT min(updated_at) FROM private_table"
        }),
        headers: {host: 'vizzuality.localhost.lan:8080' },
        method: 'GET'
    },{}, function(err, res) {
        assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
        assert.equal(res.headers['x-cache-channel'], 'cartodb_test_user_1_db:public.private_table');
        done();
    });
});

it('CREATE TABLE with GET and auth', function(done){
    assert.response(server, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'CREATE TABLE test_table(a int)',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(err, res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      // Check cache headers
      // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
      assert.ok(!res.hasOwnProperty('x-cache-channel'));
      assert.equal(res.headers['cache-control'], expected_rw_cache_control);
      done();
    });
});

it('ALTER TABLE with GET and auth', function(done){
    assert.response(server, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'ALTER TABLE test_table ADD b int',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(err, res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      // Check cache headers
      // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
      assert.ok(!res.hasOwnProperty('x-cache-channel'));
      assert.equal(res.headers['cache-control'], expected_rw_cache_control);
      done();
    });
});

it('multistatement insert, alter, select, begin, commit', function(done){
    assert.response(server, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'BEGIN; DELETE FROM test_table; COMMIT; BEGIN; INSERT INTO test_table(b) values (5); COMMIT; ' +
              'ALTER TABLE test_table ALTER b TYPE float USING b::float/2; SELECT b FROM test_table;',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(err, res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      var parsedBody = JSON.parse(res.body);
      assert.equal(parsedBody.total_rows, 1);
      assert.deepEqual(parsedBody.rows[0], {b:2.5});
      done();
    });
});

it('TRUNCATE TABLE with GET and auth', function(done){
    assert.response(server, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'TRUNCATE TABLE test_table',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(err, res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      assert.ok(!res.hasOwnProperty('x-cache-channel'));
      assert.equal(res.headers['cache-control'], expected_rw_cache_control);
      var pbody = JSON.parse(res.body);
      assert.equal(pbody.rows.length, 0);
      assert.response(server, {
          url: "/api/v1/sql?" + querystring.stringify({
            q: 'SELECT count(*) FROM test_table',
            api_key: 1234
          }),
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
      },{}, function(err, res) {
        assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
        // table should not get a cache channel as it won't get invalidated
        assert.ok(!res.headers.hasOwnProperty('x-cache-channel'));
        assert.equal(res.headers['cache-control'], expected_cache_control);
        var pbody = JSON.parse(res.body);
        assert.equal(pbody.total_rows, 1);
        assert.equal(pbody.rows[0].count, 0);
        done();
      });
    });
});

it('REINDEX TABLE with GET and auth', function(done){
    assert.response(server, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: ' ReINdEX TABLE test_table',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(err, res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      assert.ok(!res.hasOwnProperty('x-cache-channel'));
      assert.equal(res.headers['cache-control'], expected_rw_cache_control);
      var pbody = JSON.parse(res.body);
      assert.equal(pbody.rows.length, 0);
      done();
    });
});

it('DROP TABLE with GET and auth', function(done){
    assert.response(server, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'DROP TABLE test_table',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(err, res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      // Check cache headers
      // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
      assert.ok(!res.hasOwnProperty('x-cache-channel'));
      assert.equal(res.headers['cache-control'], expected_rw_cache_control);
      done();
    });
});

it('CREATE FUNCTION with GET and auth', function(done){
    assert.response(server, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'CREATE FUNCTION create_func_test(a int) RETURNS INT AS \'SELECT 1\' LANGUAGE \'sql\'',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(err, res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      // Check cache headers
      // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
      assert.ok(!res.hasOwnProperty('x-cache-channel'));
      assert.equal(res.headers['cache-control'], expected_rw_cache_control);
      done();
    });
});

it('DROP FUNCTION with GET and auth', function(done){
    assert.response(server, {
        url: "/api/v1/sql?" + querystring.stringify({
          q: 'DROP FUNCTION create_func_test(a int)',
          api_key: 1234
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(err, res) {
      assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
      // Check cache headers
      // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
      assert.ok(!res.hasOwnProperty('x-cache-channel'));
      assert.equal(res.headers['cache-control'], expected_rw_cache_control);
      done();
    });
});

it('sends a 400 when an unsupported format is requested', function(done){
    assert.response(server, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=unknown',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(err, res){
        assert.equal(res.statusCode, 400, res.body);
        assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
        assert.deepEqual(res.headers['content-disposition'], 'inline');
        assert.deepEqual(JSON.parse(res.body), {"error":[ "Invalid format: unknown" ]});
        done();
    });
});

it('GET /api/v1/sql with SQL parameter and no format, ensuring content-disposition set to json', function(done){
    assert.response(server, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(err, res){
        assert.equal(res.statusCode, 200, res.body);
        var ct = res.headers['content-type'];
        assert.ok(/json/.test(ct), 'Default format is not JSON: ' + ct);
        var cd = res.headers['content-disposition'];
        assert.equal(true, /^inline/.test(cd), 'Default format is not disposed inline: ' + cd);
        assert.equal(true, /filename=cartodb-query.json/gi.test(cd), 'Unexpected JSON filename: ' + cd);
        done();
    });
});

it('POST /api/v1/sql with SQL parameter and no format, ensuring content-disposition set to json', function(done){
    assert.response(server, {
        url: '/api/v1/sql',
        data: querystring.stringify({q: "SELECT * FROM untitle_table_4" }),
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{ }, function(err, res){
        assert.equal(res.statusCode, 200, res.body);
        var ct = res.headers['content-type'];
        assert.ok(/json/.test(ct), 'Default format is not JSON: ' + ct);
        var cd = res.headers['content-disposition'];
        assert.equal(true, /^inline/.test(cd), 'Default format is not disposed inline: ' + cd);
        assert.equal(true, /filename=cartodb-query.json/gi.test(cd), 'Unexpected JSON filename: ' + cd);
        done();
    });
});

it('GET /api/v1/sql with SQL parameter and no format, but a filename', function(done){
    assert.response(server, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&filename=x',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(err, res){
        assert.equal(res.statusCode, 200, res.body);
        var ct = res.headers['content-type'];
        assert.ok(/json/.test(ct), 'Default format is not JSON: ' + ct);
        var cd = res.headers['content-disposition'];
        assert.equal(true, /^attachment/.test(cd), 'Format with filename is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=x.json/gi.test(cd), 'Unexpected JSON filename: ' + cd);
        done();
    });
});

it('GET /api/v1/sql ensure cross domain set on errors', function(done){
    assert.response(server, {
        url: '/api/v1/sql?q=SELECT%20*gadfgadfg%20FROM%20untitle_table_4',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{
        status: 400
    }, function(err, res){
        var cd = res.headers['access-control-allow-origin'];
        assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
        assert.deepEqual(res.headers['content-disposition'], 'inline');
        assert.equal(cd, '*');
        done();
    });
});

it('GET decent error if domain is incorrect', function(done){
    assert.response(server, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&format=geojson',
        headers: {host: 'vizzualinot.cartodb.com'},
        method: 'GET'
    }, {}, function(err, res){
        assert.equal(res.statusCode, 404, res.statusCode + ( res.statusCode !== 200 ? ( ': ' + res.body ) : ''));
        assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
        assert.deepEqual(res.headers['content-disposition'], 'inline');
        var result = JSON.parse(res.body);
        assert.equal(
            result.error[0],
            "Sorry, we can't find CartoDB user 'vizzualinot'. Please check that you have entered the correct domain."
        );
        done();
    });
});

// this test does not make sense with the current CDB_QueryTables implementation
it('GET decent error if SQL is broken', function(done){
    assert.response(server, {
        url: '/api/v1/sql?' + querystring.stringify({q:
          'SELECT star FROM this and that'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(err, res){
        assert.equal(res.statusCode, 400, res.statusCode + ': ' + res.body);
        assert.deepEqual(res.headers['content-type'], 'application/json; charset=utf-8');
        assert.deepEqual(res.headers['content-disposition'], 'inline');
        var result = JSON.parse(res.body);
        // NOTE: actual error message may be slighly different, possibly worth a regexp here
        assert.equal(result.error[0], 'syntax error at or near "and"');
        done();
    });
});

// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/88
it('numeric arrays are rendered as such', function(done){
    assert.response(server, {
        url: "/api/v1/sql?" + querystring.stringify({q:
          "SELECT ARRAY[8.7,4.3]::numeric[] as x"
        }),
        headers: {host: 'vizzuality.localhost.lan:8080' },
        method: 'GET'
    },{}, function(err, res) {
        assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
        var out = JSON.parse(res.body);
        assert.ok(out.hasOwnProperty('time'));
        assert.equal(out.total_rows, 1);
        assert.equal(out.rows.length, 1);
        assert.ok(out.rows[0].hasOwnProperty('x'));
        assert.equal(out.rows[0].x.length, 2);
        assert.equal(out.rows[0].x[0], '8.7');
        assert.equal(out.rows[0].x[1], '4.3');
        assert.equal(res.headers.hasOwnProperty('x-cache-channel'), false);
        done();
    });
});

// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/97
it('field names and types are exposed', function(done){
    assert.response(server, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: "SELECT 1::int as a, 2::float8 as b, 3::varchar as c, " +
             "4::char as d, now() as e, 'a'::text as f" +
             ", 1::bool as g" +
             ", 'POINT(0 0)'::geometry as h" +
             // See https://github.com/CartoDB/CartoDB-SQL-API/issues/117
             ", now()::date as i" +
             ", '1'::numeric as j" +
             " LIMIT 0"
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(err, res) {
        assert.equal(res.statusCode, 200, res.body);
        var parsedBody = JSON.parse(res.body);
        assert.equal(_.keys(parsedBody.fields).length, 10);
        assert.equal(parsedBody.fields.a.type, 'number');
        assert.equal(parsedBody.fields.b.type, 'number');
        assert.equal(parsedBody.fields.c.type, 'string');
        assert.equal(parsedBody.fields.d.type, 'string');
        assert.equal(parsedBody.fields.e.type, 'date');
        assert.equal(parsedBody.fields.f.type, 'string');
        assert.equal(parsedBody.fields.g.type, 'boolean');
        assert.equal(parsedBody.fields.h.type, 'geometry');
        assert.equal(parsedBody.fields.i.type, 'date');
        assert.equal(parsedBody.fields.j.type, 'number');
        done();
    });
});

// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/100
it('numeric fields are rendered as numbers in JSON', function(done){
    assert.response(server, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: "WITH inp AS ( SELECT 1::int2 as a, 2::int4 as b, " +
                                  "3::int8 as c, 4::float4 as d, " +
                                  "5::float8 as e, 6::numeric as f" +
              ") SELECT a,b,c,d,e,f," +
              " ARRAY[a] AS _a, " +
              " ARRAY[b] AS _b, " +
              " ARRAY[c] AS _c, " +
              " ARRAY[d] AS _d, " +
              " ARRAY[e] AS _e, " +
              " ARRAY[f] AS _f " +
              "FROM inp"
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(err, res) {
        assert.equal(res.statusCode, 200, res.body);
        var parsedBody = JSON.parse(res.body);
        var row = parsedBody.rows[0];
        assert.equal(typeof(row.a), 'number');
        assert.equal(typeof(row.b), 'number');
        assert.equal(typeof(row.c), 'number');
        assert.equal(typeof(row.d), 'number');
        assert.equal(typeof(row.e), 'number');
        assert.equal(typeof(row.f), 'number');
        assert.equal(typeof(row._a[0]), 'number');
        assert.equal(typeof(row._b[0]), 'number');
        assert.equal(typeof(row._c[0]), 'number');
        assert.equal(typeof(row._d[0]), 'number');
        assert.equal(typeof(row._e[0]), 'number');
        assert.equal(typeof(row._f[0]), 'number');
        done();
    });
});

// Timezone information is retained with JSON output
//
// NOTE: results of these tests rely on the TZ env variable
//       being set to 'Europe/Rome'. The env variable cannot
//       be set within this test in a reliable way, see
//       https://github.com/joyent/node/issues/3286
//
// FIXME: we'd like to also test UTC outputs of these
//        numbers, but it'd currently take running the
//        test again (new mocha run) with a different TZ
//
it('timezone info in JSON output', function(done){
  step(
    function testEuropeRomeExplicit() {
      var next = this;
      assert.response(server, {
          url: '/api/v1/sql?' + querystring.stringify({
            q: "SET timezone TO 'Europe/Rome'; SELECT '2000-01-01T00:00:00+01'::timestamptz as d"
          }),
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
      },{ }, function(err, res) {
          try {
            assert.equal(res.statusCode, 200, res.body);
            var parsedBody = JSON.parse(res.body);
            assert.equal(parsedBody.rows[0].d, '2000-01-01T00:00:00+0100');
            next();
          } catch (err) {
            next(err);
          }
      });
    },
    function testEuropeRomeImplicit(err) {
      assert.ifError(err);
      var next = this;
      assert.response(server, {
          url: '/api/v1/sql?' + querystring.stringify({
            q: "SET timezone TO 'Europe/Rome'; SELECT '2000-01-01T00:00:00'::timestamp as d"
          }),
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
      },{ }, function(err, res) {
          try {
            assert.equal(res.statusCode, 200, res.body);
            var parsedBody = JSON.parse(res.body);
            assert.equal(parsedBody.rows[0].d, '2000-01-01T00:00:00+0100');
            next();
          } catch (err) {
            next(err);
          }
      });
    },
    function testUTCExplicit(err) {
      assert.ifError(err);
      var next = this;
      assert.response(server, {
          url: '/api/v1/sql?' + querystring.stringify({
            q: "SET timezone TO 'UTC'; SELECT '2000-01-01T00:00:00+00'::timestamptz as d"
          }),
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
      },{ }, function(err, res) {
          try {
            assert.equal(res.statusCode, 200, res.body);
            var parsedBody = JSON.parse(res.body);
            assert.equal(parsedBody.rows[0].d, '2000-01-01T01:00:00+0100');
            next();
          } catch (err) {
            next(err);
          }
      });
    },
    function testUTCImplicit(err) {
      assert.ifError(err);
      var next = this;
      assert.response(server, {
          url: '/api/v1/sql?' + querystring.stringify({
            q: "SET timezone TO 'UTC'; SELECT '2000-01-01T00:00:00'::timestamp as d"
          }),
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
      },{ }, function(err, res) {
          try {
            assert.equal(res.statusCode, 200, res.body);
            var parsedBody = JSON.parse(res.body);
            assert.equal(parsedBody.rows[0].d, '2000-01-01T00:00:00+0100');
            next();
          } catch (err) {
            next(err);
          }
      });
    },
    function finish(err) {
      done(err);
    }
  );
});

// WARNING and NOTICE in JSON output
// See https://github.com/CartoDB/CartoDB-SQL-API/issues/104
it('notice and warning info in JSON output', function(done){
  step(
    function addRaiseFunction() {
      assert.response(server, {
          url: '/api/v1/sql?' + querystring.stringify({
            q: "create or replace function raise(lvl text, msg text) returns void as $$ begin if lvl = 'notice' " +
                "then raise notice '%', msg; elsif lvl = 'warning' then raise warning '%', msg; " +
                "else raise exception '%', msg; end if; end; $$ language plpgsql;",
            api_key: '1234'
          }),
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
      }, RESPONSE_OK, this);
    },
    function raiseNotice(err) {
      assert.ifError(err);
      var next = this;
      assert.response(server, {
          url: '/api/v1/sql?' + querystring.stringify({
            q: "SET client_min_messages TO 'notice'; select raise('notice', 'hello notice')"
          }),
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
      }, RESPONSE_OK, function(err, res) {
          try {
            var parsedBody = JSON.parse(res.body);
            assert.ok(parsedBody.hasOwnProperty('notices'), 'Missing notices from result');
            assert.equal(parsedBody.notices.length, 1);
            assert.equal(parsedBody.notices[0], 'hello notice');
          } catch (e) {
            return next(e);
          }
          next(err);
      });
    },
    function raiseWarning(err) {
      assert.ifError(err);
      var next = this;
      assert.response(server, {
          url: '/api/v1/sql?' + querystring.stringify({
            q: "SET client_min_messages TO 'notice'; select raise('warning', 'hello warning')"
          }),
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
      }, RESPONSE_OK, function(err, res) {
          try {
            var parsedBody = JSON.parse(res.body);
            assert.ok(parsedBody.hasOwnProperty('warnings'), 'Missing warnings from result');
            assert.equal(parsedBody.warnings.length, 1);
            assert.equal(parsedBody.warnings[0], 'hello warning');
          } catch (e) {
              return next(e);
          }
          next(err);
      });
    },
    function raiseBothWarningAndNotice(err) {
      assert.ifError(err);
      var next = this;
      assert.response(server, {
          url: '/api/v1/sql?' + querystring.stringify({
            q: "SET client_min_messages TO 'notice'; select raise('warning', 'hello again warning'), " +
                "raise('notice', 'hello again notice');"
          }),
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
      }, RESPONSE_OK, function(err, res) {
          try {
            var parsedBody = JSON.parse(res.body);
            assert.ok(parsedBody.hasOwnProperty('warnings'), 'Missing warnings from result');
            assert.equal(parsedBody.warnings.length, 1);
            assert.equal(parsedBody.warnings[0], 'hello again warning');
            assert.ok(parsedBody.hasOwnProperty('notices'), 'Missing notices from result');
            assert.equal(parsedBody.notices.length, 1);
            assert.equal(parsedBody.notices[0], 'hello again notice');
          } catch (e) {
              return next(e);
          }
          next(err);
      });
    },
    function delRaiseFunction() {
      assert.response(server, {
          url: '/api/v1/sql?' + querystring.stringify({
            q: "DROP function raise(text, text)",
            api_key: '1234'
          }),
          headers: {host: 'vizzuality.cartodb.com'},
          method: 'GET'
      }, RESPONSE_OK, function(err, res) {
          try {
            assert.equal(res.statusCode, 200, res.body);
            JSON.parse(res.body);
          } catch (e) {
              err = new Error(err + ',' + e);
          }
          done(err);
      });
    }
  );
});

it('GET with callback param returns wrapped result set with callback as jsonp', function(done) {
    assert.response(server, {
        url: '/api/v1/sql?q=SELECT%20*%20FROM%20untitle_table_4&callback=foo_jsonp',
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(err, res) {
        assert.equal(res.statusCode, 200, res.body);
        assert.ok(res.body.match(/foo\_jsonp\(.*\)/));
        done();
    });
});

it('GET with callback must return 200 status error even if it is an error', function(done){
    assert.response(server, {
        url: "/api/v1/sql?q=DROP%20TABLE%20untitle_table_4&callback=foo_jsonp",
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{}, function(err, res) {
        assert.equal(res.statusCode, 200, res.statusCode + ': ' + res.body);
        var didRunJsonCallback = false;
        // jshint ignore:start
        function foo_jsonp(body) {
            assert.deepEqual(body, {"error":["must be owner of relation untitle_table_4"]});
            didRunJsonCallback = true;
        }
        eval(res.body);
        // jshint ignore:end
        assert.ok(didRunJsonCallback);
        done();
    });
});

    it('GET with slow query exceeding statement timeout returns proper error message', function(done){
        assert.response(server, {
                url: "/api/v1/sql?q=select%20pg_sleep(2.1)%20as%20sleep",
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'GET'
            },
            {
                status: 400
            },
            function(err, res) {
                assert.ok(res.body.match(/was not able to finish.*try again/i));
                done();
            });
    });

    it('too large rows get into error log', function(done){

        var dbMaxRowSize = global.settings.db_max_row_size;
        global.settings.db_max_row_size = 4;

        var consoleErrorFn = console.error;
        var hit = false;
        var consoleError;
        console.error = function(what) {
            hit = true;
            consoleError = what;
        };
        assert.response(
            server,
            {
                url: "/api/v1/sql?" + querystring.stringify({
                    q: "SELECT * FROM untitle_table_4"
                }),
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'GET'
            },
            {
                status: 400
            },
            function() {
                assert.equal(hit, true);
                var parsedError = JSON.parse(consoleError);
                assert.ok(parsedError.error.match(/^row too large.*/i), "Expecting row size limit error");
                assert.equal(parsedError.username, 'vizzuality');
                assert.equal(parsedError.type, 'row_size_limit_exceeded');

                global.settings.db_max_row_size = dbMaxRowSize;
                console.error = consoleErrorFn;

                done();
            }
        );
    });


});
