/**
 * this module allows to auth user using an pregenerated api key
 */

var _         = require('underscore')
    , Step    = require('step');

function ApikeyAuth(cartodb_redis, cartodb_request) {
  if ( ! cartodb_redis ) throw new Error("Cannot initialize ApikeyAuth with no cartodb_request");
  if ( ! cartodb_request ) throw new Error("Cannot initialize ApikeyAuth with no cartodb-redis");
  this.cdbRedis = cartodb_redis;
  this.cdbRequest = cartodb_request;
}

module.exports = ApikeyAuth;

var o = ApikeyAuth.prototype;

o.userByReq = function(req) {
  return this.cdbRequest.userByReq(req)
};

// Check if a request is authorized by api_key
//
// @param req express request object
// @param callback function(err, authorized) 
//                 
o.authorizedByAPIKey = function(req, callback)
{
    var user = this.userByReq(req);
    var that = this;
    Step(
      function (){
          that.cdbRedis.getUserMapKey(user, this);
      },
      function checkApiKey(err, val){
          if (err) throw err;

          var valid = 0;
          if ( val ) {
            if ( val == req.query.map_key ) valid = 1;
            else if ( val == req.query.api_key ) valid = 1;
            // check also in request body
            else if ( req.body && req.body.map_key && val == req.body.map_key ) valid = 1;
            else if ( req.body && req.body.api_key && val == req.body.api_key ) valid = 1;
          }

          return valid;
      },
      function finish(err, authorized) {
          callback(err, authorized);
      }
    );
};


/**
 * Get id of authorized user
 *
 * @param req - standard req object. Importantly contains table and host information
 * @param callback - err, user_id (null if no auth)
 */
o.verifyRequest = function(req, callback) {
    var user = this.userByReq(req);
    var that = this;

    Step(
        // check api key
        function(){
            that.authorizedByAPIKey(req, this);
        },
        // get user id or fail
        function (err, apikey_valid) {
            if ( err ) throw err;
            if (apikey_valid) {
                that.cdbRedis.getUserId(user, this);
            } else {
                // no auth
                callback(null, null);
            }
        },
        function (err, user_id){
            callback(err, user_id);
        }
    );
};

