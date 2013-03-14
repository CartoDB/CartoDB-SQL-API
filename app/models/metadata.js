/**
 * User: simon
 * Date: 23/08/2011
 * Time: 21:10
 * Desc: retrieves users database_name from the redis metadatabase based on subdomain/username
 */

var RedisPool = require("./redis_pool")
    , _ = require('underscore')
    , Step = require('step');


module.exports = function() {
    var me = {
        metadata_database: 5,
        user_key: "rails:users:<%= username %>"
    };

    /**
     * Get the database name for this particular subdomain/username
     *
     * @param req - standard express req object. importantly contains host information
     * @param callback
     */
    me.getDatabase = function(req, callback) {
        // strip subdomain from header host
        var username = req.headers.host.split('.')[0]
        var redisKey = _.template(this.user_key, {username: username});

        this.retrieve(redisKey, 'database_name', callback);
    };

    /**
     * Get the user id for this particular subdomain/username
     *
     * @param req - standard express req object. importantly contains host information
     * @param callback
     */
    me.getId= function(req, callback) {
        // strip subdomain from header host
        var username = req.headers.host.split('.')[0]
        var redisKey = _.template(this.user_key, {username: username});

        this.retrieve(redisKey, 'id', callback);
    };
    
    /**
     * Make a data access call to Redis
     *
     * @param redisKey - the base redis key where the metadata hash lives
     * @param hashKey - the specific metadata you want to retrieve
     * @param callback - function to pass metadata too. err,data args
     */
    me.retrieve = function(redisKey, hashKey, callback) {
        var that = this;
        var redisClient;

        Step(
            function getRedisClient() {
                RedisPool.acquire(that.metadata_database, this);
            },
            function lookupMetadata(err, data) {
                if (err) throw err;
                redisClient = data;
                redisClient.HGET(redisKey, hashKey, this);
            },
            function releaseRedisClient(err, data) {
                if ( redisClient ) RedisPool.release(that.metadata_database, redisClient);
                callback(err, data);
            }
        );
    };

    return me;
}();
