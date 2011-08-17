// too bound to the request object, but ok for now
var RedisPool = require("./redis_pool")
  , _         = require('underscore')
  , OAuthUtil = require('oauth-client')
  , url       = require('url')
  , Step      = require('step');
  _.mixin(require('underscore.string'));  

var oAuth = function(){
  var me = {
    oauth_database: 3,
    oauth_user_key: "rails:oauth_access_tokens:<%= oauth_access_key %>" 
  };  
  
  // oauth token cases:
  // * in GET request
  // * in header    
  me.parseTokens = function(req){
    var query_oauth = _.clone(req.query);
    var header_oauth = {};
    var oauth_variables = ['oauth_consumer_key', 
                           'oauth_token', 
                           'oauth_signature_method', 
                           'oauth_signature',
                           'oauth_timestamp',
                           'oauth_nonce',
                           'oauth_version'];

    // pull only oauth tokens out of query                   
    var non_oauth  = _.difference(_.keys(query_oauth), oauth_variables);    
    _.each(non_oauth, function(key){ delete query[key]; });        

    // pull oauth tokens out of header
    var header_string = req.headers.authorization;
    if (!_.isUndefined(header_string)) {    
      _.each(oauth_variables, function(oauth_key){
        var matched_string = header_string.match(new RegExp(oauth_key + '=\"([^\"]+)\"'))
        if (!_.isNull(matched_string))
          header_oauth[oauth_key] = decodeURIComponent(matched_string[1]);
      });
    } 
         
    //merge header and query oauth tokens. preference given to header oauth
    var oauth = _.defaults(header_oauth, query_oauth);
    if (_.keys(oauth).length !== oauth_variables.length) {
      throw Error('incomplete oauth tokens in request');
    } else {
      return oauth;
    }    
  }  
  
  // remove oauthy tokens from an object
  me.splitParams = function(obj) {
  	var removed = null;
  	for (var prop in obj) {
  		if (/^oauth_\w+$/.test(prop)) {
  			if(!removed) {
  				removed = {};
  			}
  			removed[prop] = obj[prop];
  			delete obj[prop];
  		}
  	}
  	return removed;
  }
    
    
  // oauth token cases:
  // * in GET request
  // * in header
  // WARNING DEPRECATED
  me.parseParams = function(req){
    var oauth_token = null;

    if (_.isString(req.query.oauth_token)){
      oauth_token = _.trim(req.query.oauth_token);
    } else if (_.isString(req.headers.authorization)) { 
      oauth_token = req.headers.authorization.match(/oauth_token=\"([^\"]+)\"/)[1]
    }

    return (_.isString(oauth_token)) ? oauth_token : null
  }

  // find user from redis oauth token DB
  // WARNING DEPRECATION IMMINENT
  me.getUserId = function(access_key, callback){
    var that = this;
    RedisPool.acquire(this.oauth_database, function(client){
      var redisClient = client;
      redisClient.hget(_.template(that.oauth_user_key, {oauth_access_key: access_key}), "user_id", function(err, user_id){
        RedisPool.release(that.oauth_database, redisClient);
        return callback(err, user_id)      
      });      
    });
  }
  
  // do new fancy get User ID
  me.verifyRequest = function(req, callback){
    var that = this;
    var http = arguments['2'];
    var passed_tokens;
    var ohash; 
    var signature;
    
    Step(
      function getTokensFromURL(){
        return oAuth.parseTokens(req);
      },
      function getOAuthHash(err, data){
        if (err) throw err;
        passed_tokens = data;
        that.getOAuthHash(passed_tokens.oauth_token, this);
      },
      function regenerateSignature(err, data){
        if (err) throw err;
        ohash = data;
        var consumer     = OAuthUtil.createConsumer(ohash.consumer_key, ohash.consumer_secret);
        var access_token = OAuthUtil.createToken(ohash.access_token_token, ohash.access_token_secret);
        var signer       = OAuthUtil.createHmac(consumer, access_token);
        
        var method = req.method;
        var host   = req.headers.host;
        var path   = http ? 'http://' + host + req.route.path : 'https://' + host + req.route.path;
        that.splitParams(req.query);
        
        // remove signature from passed_tokens
        signature = passed_tokens.oauth_signature;
        delete passed_tokens['oauth_signature'];
                
        var base64;
      	var joined = {};

      	_.extend(joined, req.body ? req.body : null);
      	_.extend(joined, passed_tokens);
      	_.extend(joined, req.query);
        
      	return signer.sign(method, path, joined);
      },
      function checkSignature(err, data){        
        if (err) callback(err, null);
        callback(err, (signature === data && !_.isUndefined(data)) ? ohash.user_id : null);
      }
    );
  }
    
  me.getOAuthHash = function(access_key, callback){
    var that = this;
    RedisPool.acquire(this.oauth_database, function(client){
      var redisClient = client;
      redisClient.HGETALL(_.template(that.oauth_user_key, {oauth_access_key: access_key}), function(err, data){
        RedisPool.release(that.oauth_database, redisClient);
        return callback(err, data)      
      });      
    });
  };
    
  // helper method
  // GONNA DEPRECATE
  me.authorize = function(req, callback){
    var oauth_params = this.parseParams(req);    
    return this.getUserId(oauth_params, callback);
  }
  
  return me;
}();

module.exports = oAuth;  
  

// get the user secrets and shit by the consumer id, then do the signature. if ok, return user id.
