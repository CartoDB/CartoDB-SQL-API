/**
 * this module allows to auth user using an pregenerated api key
 */

var Meta = require("cartodb-redis")({
    host: global.settings.redis_host,
    port: global.settings.redis_port
  })
  , _         = require('underscore')
  , Step      = require('step');

module.exports = (function() {

    var me = {}

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
                Meta.checkAPIKey(req, this);
            },
            // get user id or fail
            function (err, apikey_valid) {
                if ( err ) throw err;
                if (apikey_valid) {
                    Meta.getId(req, this);
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
    return me;
})();
