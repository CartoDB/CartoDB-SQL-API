require('../helper');

var _        = require('underscore')
    , OAuthAuth  = require('../../app/auth/oauth')
    , MetadataDB  = require('cartodb-redis')
    , oAuth  = require('../../app/auth/oauth').backend
    , assert = require('assert')
    , tests  = module.exports = {}
    , oauth_data_1 = {
        oauth_consumer_key: "dpf43f3p2l4k3l03",
        oauth_token: "nnch734d00sl2jdk",
        oauth_signature_method: "HMAC-SHA1",
        oauth_signature: "tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D",
        oauth_timestamp:"1191242096",
        oauth_nonce:"kllo9940pd9333jh"
    }
    , oauth_data_2        = { oauth_version:"1.0" }
    , oauth_data          = _.extend(oauth_data_1, oauth_data_2)
    , real_oauth_header   = 'OAuth realm="http://vizzuality.testhost.lan/",oauth_consumer_key="fZeNGv5iYayvItgDYHUbot1Ukb5rVyX6QAg8GaY2",oauth_token="l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR",oauth_signature_method="HMAC-SHA1", oauth_signature="o4hx4hWP6KtLyFwggnYB4yPK8xI%3D",oauth_timestamp="1313581372",oauth_nonce="W0zUmvyC4eVL8cBd4YwlH1nnPTbxW0QBYcWkXTwe4",oauth_version="1.0"'
    , oauth_header_tokens = 'oauth_consumer_key="dpf43f3p2l4k3l03",oauth_token="nnch734d00sl2jdk",oauth_signature_method="HMAC-SHA1", oauth_signature="tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D",oauth_timestamp="1191242096",oauth_nonce="kllo9940pd9333jh",oauth_version="1.0"'
    , full_oauth_header   = 'OAuth realm="http://photos.example.net/"' + oauth_header_tokens;

var metadataBackend = MetadataDB({
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
});

suite('oauth', function() {

test('test database number', function(){
    assert.equal(oAuth.oauth_database, 3);
});

test('test oauth database key', function(){
    assert.equal(oAuth.oauth_user_key, "rails:oauth_access_tokens:<%= oauth_access_key %>");
});

test('test parse tokens from full headers does not raise exception', function(){
    var req = {query:{}, headers:{authorization:full_oauth_header}};
    assert.doesNotThrow(function(){ oAuth.parseTokens(req) }, /incomplete oauth tokens in request/);
});

test('test parse all normal tokens raises no exception', function(){
    var req = {query:oauth_data, headers:{}};
    assert.doesNotThrow(function(){ oAuth.parseTokens(req) }, /incomplete oauth tokens in request/);
});

test('test headers take presedence over query parameters', function(){
    var req = {query:{oauth_signature_method: "MY_HASH"}, headers:{authorization:full_oauth_header}};
    var tokens = oAuth.parseTokens(req);
    assert.equal(tokens.oauth_signature_method, "HMAC-SHA1");
});

test('test can access oauth hash for a user based on access token (oauth_token)', function(done){
    var req = {query:{}, headers:{authorization:real_oauth_header}};
    var tokens = oAuth.parseTokens(req);

    oAuth.getOAuthHash(metadataBackend, tokens.oauth_token, function(err, data){
        console.log(data);
        assert.equal(tokens.oauth_consumer_key, data.consumer_key);
        done();
    });
});

test('test non existant oauth hash for a user based on oauth_token returns empty hash', function(done){
    var req = {query:{}, headers:{authorization:full_oauth_header}};
    var tokens = oAuth.parseTokens(req);

    oAuth.getOAuthHash(metadataBackend, tokens.oauth_token, function(err, data){
        assert.ok(!err, err);
        assert.deepEqual(data, {});
        done();
    });
});

test('can return user for verified signature', function(done){
    var req = {query:{},
        headers:{authorization:real_oauth_header, host: 'vizzuality.testhost.lan' },
        protocol: 'http',
        method: 'GET',
        path: '/api/v1/tables'
    };

    oAuth.verifyRequest(req, metadataBackend, function(err, data){
        assert.ok(!err, err);
        assert.equal(data, 1);
        done();
    });
});

test('returns null user for unverified signatures', function(done){
    var req = {query:{},
        headers:{authorization:real_oauth_header, host: 'vizzuality.testyhost.lan' },
        protocol: 'http',
        method: 'GET',
        path: '/api/v1/tables'
    };

    oAuth.verifyRequest(req, metadataBackend, function(err, data){
        assert.equal(data, null);
        done();
    });
});

test('returns null user for no oauth', function(done){
    var req = {
        query:{},
        headers:{},
        protocol: 'http',
        method: 'GET',
        path: '/api/v1/tables'
    };

    oAuth.verifyRequest(req, metadataBackend, function(err,data){
        assert.equal(data, null);
        done();
    });
});

test('OAuthAuth reports it has credentials', function(done) {
    var req = {query:{}, headers:{authorization:real_oauth_header}};
    var oAuthAuth = new OAuthAuth(req);
    assert.ok(oAuthAuth.hasCredentials());
    done();
});

test('OAuthAuth reports it has no credentials', function(done) {
    var req = {query:{}, headers:{}};
    var oAuthAuth = new OAuthAuth(req);
    assert.equal(oAuthAuth.hasCredentials(), false);
    done();
});


});
