require('../helper');

var _      = require('underscore')
  , redis  = require("redis")
  , oAuth  = require('../../app/models/oauth')
  , assert = require('assert');

exports['test database number'] = function(){
  assert.equal(oAuth.oauth_database, 3);
};

exports['test oauth database key'] = function(){
  assert.equal(oAuth.oauth_user_key, "rails:oauth_tokens:<%= oauth_token %>");    
};

exports['test parse token from request query'] = function(){
  req = {query:{oauth_token:"test_token"}}    
  assert.equal(oAuth.parseToken(req), "test_token");    
};

exports['test parse token from request header'] = function(){
  req = {query:{}, headers:{authorization:"oauth_token=\"test_token\""}}    
  assert.equal(oAuth.parseToken(req), "test_token");    
};

exports['test parse null empty token from request'] = function(){
  req = {query:{}, headers:{}}
  assert.equal(oAuth.parseToken(req), null);
}

exports['test getUserId returns null user when passed null token'] = function(){
  oAuth.getUserId(null, function(err,user_id){
    assert.equal(user_id, null);
  });    
}

exports['test getUserId error returns null when passed null token'] = function(){
  oAuth.getUserId(null, function(err,user_id){
    assert.equal(err, null);
  });    
}

exports['returns a user id if there is an oauth_token in redis'] = function(){
  var redisClient = redis.createClient();     
  redisClient.select(oAuth.oauth_database);
  
  // make a dummy user_id/token combo and test
  redisClient.HSET(_.template(oAuth.oauth_user_key, {oauth_token: "test_token"}), 'user_id', 9999, function(){
    oAuth.getUserId("test_token", function(err,user_id){
      assert.equal(user_id, 9999);
      redisClient.quit();
    });          
  });      
}

exports['authorize returns null if no oauth_token'] = function(){
  req = {query:{}, headers:{}}
  
  oAuth.authorize(req, function(err,user_id){
    assert.equal(user_id, null);
  });          
}

exports['authorize returns user_id if valid query oauth_token set'] = function(){
  var redisClient = redis.createClient();     
  redisClient.select(oAuth.oauth_database);
  
  // make a dummy user_id/token combo and test
  redisClient.HSET(_.template(oAuth.oauth_user_key, {oauth_token: "test_token_1"}), 'user_id', 9999, function(){
    req = {query:{oauth_token:"test_token_1"}, headers:{}}
    oAuth.authorize(req, function(err,user_id){
      assert.equal(user_id, 9999);
      redisClient.quit();
    });              
  });      
}


exports['authorize returns user_id if valid header oauth_token set'] = function(){
  var redisClient = redis.createClient();     
  redisClient.select(oAuth.oauth_database);
  
  // make a dummy user_id/token combo and test
  redisClient.HSET(_.template(oAuth.oauth_user_key, {oauth_token: "test_token_2"}), 'user_id', 9999, function(){
    req = {query:{},  headers:{authorization:"oauth_token=\"test_token_2\""}}
    oAuth.authorize(req, function(err,user_id){
      assert.equal(user_id, 9999);
      redisClient.quit();
    }); 
  }); 
}
