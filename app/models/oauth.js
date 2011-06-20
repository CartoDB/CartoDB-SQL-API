// too bound to the request object, but ok for now
var RedisPool = require("./redis_pool")
  , _         = require('underscore');
  _.mixin(require('underscore.string'));  

var oAuth = function(){
    var me = {
      oauth_database: 3,
      oauth_user_key: "rails:oauth_tokens:<%= oauth_token %>" 
    };  
    
  // oauth token cases:
  // * in GET request
  // * in header
  me.parseToken = function(req){
    var oauth_token = null;

    if (_.isString(req.query.oauth_token)){
      oauth_token = _.trim(req.query.oauth_token);
    } else if (_.isString(req.headers.authorization)) { 
      oauth_token = req.headers.authorization.match(/oauth_token=\"([^\"]+)\"/)[1]
    }

    return (_.isString(oauth_token)) ? oauth_token : null
  }

  // find user from redis oauth token DB
  me.getUserId = function(oauth_token, callback){
    var that = this;
    RedisPool.acquire(this.oauth_database, function(client){
      var redisClient = client;
      redisClient.hget(_.template(that.oauth_user_key, {oauth_token: oauth_token}), "user_id", function(err, user_id){
        RedisPool.release(that.oauth_database, redisClient);
        return callback(err, user_id)      
      });      
    });
  }
  
  // helper method
  me.authorize = function(req, callback){
    var oauth_token = this.parseToken(req);    
    return this.getUserId(oauth_token, callback);
  }
  
  return me;
}();

module.exports = oAuth;  
  
