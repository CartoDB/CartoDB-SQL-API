/**
 * User: simon
 * Date: 23/08/2011
 * Time: 21:10
 * Desc: retrieves users database_name from the redis metadatabase based on subdomain/username
 */

var RedisPool   = require("./redis_pool")
    , _         = require('underscore')
    , Step      = require('step');

var Metadata = function(){
    var me = {
        metadata_database: 5,
        user_key: "rails:users:<%= username %>"
    };

    me.getDatabase = function(req, callback){
        // strip subdomain from header host
        var username = req.headers.host.split('.')[0]
        var redisClient;

        Step(
            function getUserMetadataRedisClient(){
                RedisPool.acquire(this.metadata_database, this);
            },
            function lookupUsersMetadata(err, data){
                if (err) throw err;
                redisClient = data;
                redisClient.HGET(_.template(this.user_key, {username: username}), 'database_name', this);
            },
            function getDatabase(err, data) {
                if (err) throw err;
                RedisPool.release(this.metadata_database, redisClient);
                callback(err, data);
            }
        );
    };

    return me;
}();

module.exports = Metadata;