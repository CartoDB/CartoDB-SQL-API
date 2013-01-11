require('../../helper');
require('../../support/assert');


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

suite('export.shapefile', function() {

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

test('SHP format, unauthenticated, POST', function(done){
    assert.response(app, {
        url: '/api/v1/sql',
        data: 'q=SELECT%20*%20FROM%20untitle_table_4%20LIMIT%201&format=shp',
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'SHP is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.zip/gi.test(cd), 'Unexpected SHP filename: ' + cd);
        done();
    });
});

test('SHP format, big size, POST', function(done){
    assert.response(app, {
        url: '/api/v1/sql',
        data: querystring.stringify({
          q: 'SELECT 0 as fname FROM generate_series(0,81920)',
          format: 'shp'
        }),
        headers: {host: 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var cd = res.header('Content-Disposition');
        assert.equal(true, /^attachment/.test(cd), 'SHP is not disposed as attachment: ' + cd);
        assert.equal(true, /filename=cartodb-query.zip/gi.test(cd), 'Unexpected SHP filename: ' + cd);
        assert.ok(res.body.length > 81920, 'SHP smaller than expected: ' + res.body.length);
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


// See https://github.com/Vizzuality/CartoDB-SQL-API/issues/66
test('SHP format, unauthenticated, with utf8 data', function(done){
    var query = querystring.stringify({
        q: "SELECT '♥♦♣♠' as f, st_makepoint(0,0,4326) as the_geom",
        format: 'shp',
        filename: 'myshape'
      });
    assert.response(app, {
        url: '/api/v1/sql?' + query,
        headers: {host: 'vizzuality.cartodb.com'},
        encoding: 'binary',
        method: 'GET'
    },{ }, function(res){
        assert.equal(res.statusCode, 200, res.body);
        var tmpfile = '/tmp/myshape.zip';
        var err = fs.writeFileSync(tmpfile, res.body, 'binary');
        if (err) { done(err); return }
        var zf = new zipfile.ZipFile(tmpfile);
        var buffer = zf.readFileSync('myshape.dbf');
        fs.unlinkSync(tmpfile);
        var strings = buffer.toString();
        assert.ok(/♥♦♣♠/.exec(strings), "Cannot find '♥♦♣♠' in here:\n" + strings);
        done();
    });
});


});
