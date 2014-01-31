require('../helper');
require('../support/assert');

var app    = require(global.settings.app_root + '/app/controllers/app')()
    , assert = require('assert')
    , tests  = module.exports = {}
    , querystring = require('querystring');

suite('app.auth', function() {

test('valid api key should allow insert in protected tables', function(done){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=1234&q=INSERT%20INTO%20private_table%20(name)%20VALUES%20('app_auth_test1')",
        headers: {host: 'vizzuality.localhost.lan:8080' },
        method: 'GET'
    },{}, function(res) {
        assert.equal(res.statusCode, 200, res.body);
        done();
    });
});

test('invalid api key should NOT allow insert in protected tables', function(done){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=RAMBO&q=INSERT%20INTO%20private_table%20(name)%20VALUES%20('RAMBO')",

        headers: {host: 'vizzuality.cartodb.com' },
        method: 'GET'
    },{
        status: 400
    }, function() { done(); });
});

test('invalid api key (old redis location) should NOT allow insert in protected tables', function(done){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?api_key=1235&q=INSERT%20INTO%20private_table%20(name)%20VALUES%20('RAMBO')",

        headers: {host: 'vizzuality.cartodb.com' },
        method: 'GET'
    },{
        status: 400
    }, function() { done(); });
});

test('no api key should NOT allow insert in protected tables', function(done){
    assert.response(app, {
        // view prepare_db.sh to see where to set api_key
        url: "/api/v1/sql?q=INSERT%20INTO%20private_table%20(name)%20VALUES%20('RAMBO')",

        headers: {host: 'vizzuality.cartodb.com' },
        method: 'GET'
    },{
        status: 400
    }, function() { done(); });
});

test('no api key should NOT allow insert in public tables', function(done){
    assert.response(app, {
        // view prepare_db.sh to find public table name and structure
        url: "/api/v1/sql?q=INSERT%20INTO%20untitle_table_4%20(name)%20VALUES%20('RAMBO')",

        headers: {host: 'vizzuality.cartodb.com' },
        method: 'GET'
    },{
        status: 400
    }, function() { done(); });
});

});
