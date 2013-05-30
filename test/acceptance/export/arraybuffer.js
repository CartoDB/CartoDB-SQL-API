require('../../helper');
require('../../support/assert');


var app    = require(global.settings.app_root + '/app/controllers/app')
    , assert = require('assert')
    , querystring = require('querystring')
    , _ = require('underscore')
    , zipfile = require('zipfile')
    , fs      = require('fs')
    , libxmljs = require('libxmljs')
    , Step = require('step')
    ;

// allow lots of emitters to be set to silence warning
app.setMaxListeners(0);

suite('export.arraybuffer', function() {

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

test('GET /api/v1/sql as arraybuffer ', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: 'SELECT cartodb_id,name,1::integer,187.9 FROM untitle_table_4',
          format: 'arraybuffer'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        assert.equal(res.headers['content-type'], "application/octet-stream")
        done();
    });
});

test('GET /api/v1/sql as arraybuffer does not support geometry types ', function(done){
    assert.response(app, {
        url: '/api/v1/sql?' + querystring.stringify({
          q: 'SELECT cartodb_id, the_geom FROM untitle_table_4',
          format: 'arraybuffer'
        }),
        headers: {host: 'vizzuality.cartodb.com'},
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 400, res.body);
        var result = JSON.parse(res.body);
        assert.equal(result.error[0], "geometry types are not supported");

        done();
    });
});

});
