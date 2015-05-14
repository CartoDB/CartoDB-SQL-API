require('../helper');

var app    = require(global.settings.app_root + '/app/controllers/app')();
var assert = require('../support/assert');
var querystring = require('querystring');
var _ = require('underscore');

// allow lots of emitters to be set to silence warning
app.setMaxListeners(0);

describe('x_cache_channel', function() {

assert.contains = function(ary, elem) {
  assert.ok(_.contains(ary,elem), 'missing "' + elem +'" from x-cache-channel: '+ ary);
};

it('supports joins', function(done) {
    var query = querystring.stringify({
       q: "SELECT a.name as an, b.name as bn FROM untitle_table_4 a " +
           "left join private_table b ON (a.cartodb_id = b.cartodb_id)",
       api_key: 1234
    });
    assert.response(app, {
        url: '/api/v1/sql?' + query,
        headers: {host: 'vizzuality.cartodb.com' },
        method: 'GET'
    },{ }, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        // Check x-cache headers
        var cc = res.headers['x-cache-channel'].split(':');
        assert.equal(cc[0], 'cartodb_test_user_1_db');
        var tt = cc[1].split(',');
        assert.equal(tt.length, 2);
        assert.contains(tt, 'public.private_table');
        assert.contains(tt, 'public.untitle_table_4');
        done();
    });
});

it('supports multistatements', function(done) {
    var query = querystring.stringify({
       q: "SELECT * FROM untitle_table_4; SELECT * FROM private_table",
       api_key: 1234
    });
    assert.response(app, {
        url: '/api/v1/sql?' + query,
        headers: {host: 'vizzuality.cartodb.com' },
        method: 'GET'
    },{ }, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        // Check x-cache headers
        var cc = res.headers['x-cache-channel'].split(':');
        assert.equal(cc[0], 'cartodb_test_user_1_db');
        var tt = cc[1].split(',');
        assert.equal(tt.length, 2);
        assert.contains(tt, 'public.private_table');
        assert.contains(tt, 'public.untitle_table_4');
        done();
    });
});

it('supports explicit transactions', function(done) {
    var query = querystring.stringify({
       q: "BEGIN; SELECT * FROM untitle_table_4; COMMIT; BEGIN; SELECT * FROM private_table; COMMIT;",
       api_key: 1234
    });
    assert.response(app, {
        url: '/api/v1/sql?' + query,
        headers: {host: 'vizzuality.cartodb.com' },
        method: 'GET'
    },{ }, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        // Check x-cache headers
        var cc = res.headers['x-cache-channel'].split(':');
        assert.equal(cc[0], 'cartodb_test_user_1_db');
        var tt = cc[1].split(',');
        assert.equal(tt.length, 2);
        assert.contains(tt, 'public.private_table');
        assert.contains(tt, 'public.untitle_table_4');
        done();
    });
});

it('survives partial transactions', function(done) {
    var query = querystring.stringify({
       q: "BEGIN; SELECT * FROM untitle_table_4",
       api_key: 1234
    });
    assert.response(app, {
        url: '/api/v1/sql?' + query,
        headers: {host: 'vizzuality.cartodb.com' },
        method: 'GET'
    },{ }, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        // Check x-cache headers
        var cc = res.headers['x-cache-channel'].split(':');
        assert.equal(cc[0], 'cartodb_test_user_1_db');
        var tt = cc[1].split(',');
        assert.equal(tt.length, 1);
        assert.contains(tt, 'public.untitle_table_4');
        done();
    });
});

});
