/**
 * this module allows to auth user using an pregenerated api key
 */

var RedisPool = require("./redis_pool")
  , _         = require('underscore')
  , Step      = require('step');

module.exports = (function() {

    var me = {
        user_metadata_db: 5,
        table_metadata_db: 0,
        user_key: "rails:users:<%= username %>",
        table_key: "rails:<%= database_name %>:<%= table_name %>"
    };

    me.retrieve = function(db, redisKey, hashKey, callback) {
        this.redisCmd(db,'HGET',[redisKey, hashKey], callback);
    };

    me.inSet = function(db, setKey, member, callback) {
        this.redisCmd(db,'SISMEMBER',[setKey, member], callback);
    };

    /**
     * Use Redis
     *
     * @param db - redis database number
     * @param redisFunc - the redis function to execute
     * @param redisArgs - the arguments for the redis function in an array
     * @param callback - function to pass results too.
     */
    me.redisCmd = function(db, redisFunc, redisArgs, callback) {

        var redisClient;
        Step(
            function() {
                var step = this;
                RedisPool.acquire(db, function(err, _redisClient) {
                    if ( err ) { step(err); return };
                    redisClient = _redisClient;
                    redisArgs.push(step);
                    redisClient[redisFunc.toUpperCase()].apply(redisClient, redisArgs);
                });
            },
            function releaseRedisClient(err, data) {
                if ( redisClient ) RedisPool.release(db, redisClient);
                callback(err, data);
            }
        );
    };


    /**
     * Get the user id for this particular subdomain/username
     *
     * @param req - standard express req object. importantly contains host information
     * @param callback
     */
    me.getId = function(req, callback) {
        // strip subdomain from header host
        var username = req.headers.host.split('.')[0];
        var redisKey = _.template(this.user_key, {username: username});

        this.retrieve(this.user_metadata_db, redisKey, 'id', callback);
    };

    /**
     * Get the user map key for this particular subdomain/username
     *
     * @param req - standard express req object. importantly contains host information
     * @param callback
     */
    me.checkAPIKey= function(req, callback) {
        // strip subdomain from header host
        var username = req.headers.host.split('.')[0];
        var redisKey = "rails:users:" + username;
        var api_key = req.query.api_key || req.body.api_key;
        this.retrieve(this.user_metadata_db, redisKey, "map_key", function(err, val) {
          var allow = 0;
          if ( val && val == api_key ) allow = 1;
          callback(err, allow);
        });
    };

    /**
     * Get privacy for cartodb table
     *
     * @param req - standard req object. Importantly contains table and host information
     * @param callback - err, user_id (null if no auth)
     */
    me.verifyRequest = function(req, callback) {
        var that = this;

        Step(
            // check api key
            function(){
                that.checkAPIKey(req, this);
            },
            // get user id or fail
            function (err, apikey_valid) {
                if (apikey_valid) {
                    that.getId(req, this);
                } else {
                    // no auth
                    callback(false, null);
                }
            },
            function (err, user_id){
                if (err) callback(err);
                else callback(false, user_id);
            }
        );
    };
    return me;
})();
