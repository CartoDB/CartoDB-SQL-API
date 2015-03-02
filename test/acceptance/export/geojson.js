
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
// TODO: check if still needed ...
app.setMaxListeners(0);

// use dec_sep for internationalization
var checkDecimals = function(x, dec_sep){
    var tmp='' + x;
    if (tmp.indexOf(dec_sep)>-1)
        return tmp.length-tmp.indexOf(dec_sep)-1;
    else
        return 0;
}

suite('export.geojson', function() {

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

test('POST /api/v1/sql with SQL parameter and geojson format, ensuring content-disposition set to geojson', function(done){
    assert.response(app, {
        url: '/api/v1/sql', 
        data: querystring.stringify({q: "SELECT * FROM untitle_table_4", format: 'geojson' }),
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
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

test('null geometries in geojson output', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: "SELECT 1 as gid, 'U' as name, null::geometry as the_geom ",
          format: 'geojson'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'GEOJSON is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.geojson/gi.test(cd));
        var gjson = JSON.parse(res.body);
        var expected = {
            type: 'FeatureCollection',
            features: [ { type: 'Feature',
                properties: { gid: 1, name: 'U' },
                geometry: null } ]
         };
        assert.deepEqual(gjson, expected);
        done();
      });
});

test('stream response handle errors', function(done) {
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
            q: "SELECTT 1 as gid, null::geometry as the_geom ",
            format: 'geojson'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        console.log(res);
        assert.equal(res.statusCode, 400, res.body);
        var geoJson = JSON.parse(res.body);
        assert.ok(geoJson.error);
        assert.equal(geoJson.error.length, 1);
        assert.ok(geoJson.error[0].match(/^syntax error at or near.*/));
        done();
    });
});

test('stream response with empty result set has valid output', function(done) {
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
            q: "SELECT 1 as gid, null::geometry as the_geom limit 0",
            format: 'geojson'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var geoJson = JSON.parse(res.body);
        var expectedGeoJson = {"type": "FeatureCollection", "features": []};
        assert.deepEqual(geoJson, expectedGeoJson);
        done();
    });
});

});
