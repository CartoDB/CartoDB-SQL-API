require('../helper');

var _      = require('underscore')
  , redis  = require("redis")
  , oAuth  = require('../../app/models/oauth')
  , assert = require('assert')

  , tests  = module.exports = {};  

var oauth_data_1 = {
  oauth_consumer_key: "dpf43f3p2l4k3l03",
  oauth_token: "nnch734d00sl2jdk",
  oauth_signature_method: "HMAC-SHA1", 
  oauth_signature: "tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D",
  oauth_timestamp:"1191242096",
  oauth_nonce:"kllo9940pd9333jh"  
}
var oauth_data_2 = { oauth_version:"1.0" }
var oauth_data = _.extend(oauth_data_1, oauth_data_2);

var oauth_header_tokens = 'oauth_consumer_key="dpf43f3p2l4k3l03",oauth_token="nnch734d00sl2jdk",oauth_signature_method="HMAC-SHA1", oauth_signature="tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D",oauth_timestamp="1191242096",oauth_nonce="kllo9940pd9333jh",oauth_version="1.0"'  
var full_oauth_header = 'OAuth realm="http://photos.example.net/"' + oauth_header_tokens;
var part_oauth_header = 'oauth_token="ad180jjd733klru7",oauth_signature_method="HMAC-SHA1"'


tests['test database number'] = function(){
  assert.equal(oAuth.oauth_database, 3);
};

tests['test oauth database key'] = function(){
  assert.equal(oAuth.oauth_user_key, "rails:oauth_access_tokens:<%= oauth_access_key %>");    
};

tests['test parse tokens from full headers does not raise exception'] = function(){
  var req = {query:{}, headers:{authorization:full_oauth_header}}    
  assert.doesNotThrow(function(){ oAuth.parseTokens(req) }, /incomplete oauth tokens in request/);    
};

tests['test parse all normal tokens raises no exception'] = function(){
  var req = {query:oauth_data, headers:{}}    
  assert.doesNotThrow(function(){ oAuth.parseTokens(req) }, /incomplete oauth tokens in request/);    
};

tests['test headers take presedence over query parameters'] = function(){
  var req = {query:{oauth_signature_method: "MY_HASH"}, headers:{authorization:full_oauth_header}}    
  var tokens = oAuth.parseTokens(req);  
  assert.equal(tokens.oauth_signature_method, "HMAC-SHA1");
};


// before this, you must embed the test OAUTH hash in redis so everything works.
// Request url: http://vizzuality.testhost.lan/api/v1/tables
// hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR consumer_key fZeNGv5iYayvItgDYHUbot1Ukb5rVyX6QAg8GaY2
// hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR consumer_secret IBLCvPEefxbIiGZhGlakYV4eM8AbVSwsHxwEYpzx
// hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR access_token_token l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR
// hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR access_token_secret 22zBIek567fMDEebzfnSdGe8peMFVFqAreOENaDK
// hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR user_id 1
// hset rails:oauth_access_tokens:l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR time sometime

////the headers for this are:
//var real_oauth_header = 'OAuth realm="http://vizzuality.testhost.lan/",oauth_consumer_key="fZeNGv5iYayvItgDYHUbot1Ukb5rVyX6QAg8GaY2",oauth_token="l0lPbtP68ao8NfStCiA3V3neqfM03JKhToxhUQTR",oauth_signature_method="HMAC-SHA1", oauth_signature="o4hx4hWP6KtLyFwggnYB4yPK8xI%3D",oauth_timestamp="1313581372",oauth_nonce="W0zUmvyC4eVL8cBd4YwlH1nnPTbxW0QBYcWkXTwe4",oauth_version="1.0"';
//
//tests['test can access oauth hash for a user based on access token (oauth_token)'] = function(){
//  var req = {query:{}, headers:{authorization:real_oauth_header}};
//  var tokens = oAuth.parseTokens(req);
//
//  oAuth.getOAuthHash(tokens.oauth_token, function(err, data){
//    assert.equal(tokens.oauth_consumer_key, data.consumer_key)
//  });
//};
//
//tests['test non existant oauth hash for a user based on oauth_token returns empty hash'] = function(){
//  var req = {query:{}, headers:{authorization:full_oauth_header}};
//  var tokens = oAuth.parseTokens(req);
//
//  oAuth.getOAuthHash(tokens.oauth_token, function(err, data){
//    assert.eql(data, {})
//  });
//};
//
//tests['can return user for verified signature'] = function(){
//  var req = {query:{},
//         headers:{authorization:real_oauth_header, host: 'vizzuality.testhost.lan' },
//         method: 'GET',
//         route: {path: '/api/v1/tables'}
//         };
//
//  oAuth.verifyRequest(req, function(err, data){
//    assert.eql(data, 1);
//  }, true)
//};
//
//tests['returns null user for unverified signatures'] = function(){
//  var req = {query:{},
//         headers:{authorization:real_oauth_header, host: 'vizzuality.testyhost.lan' },
//         method: 'GET',
//         route: {path: '/api/v1/tables'}
//         };
//
//  oAuth.verifyRequest(req, function(err, data){
//    assert.eql(data, null);
//  }, true)
//};
//
//tests['returns null user for no oauth'] = function(){
//  var req = {
//             query:{},
//             headers:{},
//             method: 'GET',
//             route: {path: '/api/v1/tables'}
//            };
//
//  oAuth.verifyRequest(req,function(err,data){
//     assert.eql(data, null);
//  });
//};
//
