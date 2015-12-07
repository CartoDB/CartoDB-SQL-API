'use strict';

var step = require('step');
var _ = require('underscore');
var AuthApi = require('../auth/auth_api');

function DbService() {
}

DbService.prototype.getUserDatabase = function (options, callback) {
    var req = options.req;
    var params = options.params;
    var checkAborted = options.checkAborted;
    var metadataBackend = options.metadataBackend;
    var cdbUsername = options.cdbUsername;

    var authApi = new AuthApi(req, params);

    var dbParams;
    var dbopts = {
        port: global.settings.db_port,
        pass: global.settings.db_pubuser_pass
    };

    // 1. Get database from redis via the username stored in the host header subdomain
    // 2. Run the request through OAuth to get R/W user id if signed
    // 3. Set to user authorization params
    step(
        function getDatabaseConnectionParams() {
            checkAborted('getDatabaseConnectionParams');
            // If the request is providing credentials it may require every DB parameters
            if (authApi.hasCredentials()) {
                metadataBackend.getAllUserDBParams(cdbUsername, this);
            } else {
                metadataBackend.getUserDBPublicConnectionParams(cdbUsername, this);
            }
        },
        function authenticate(err, userDBParams) {
            if (err) {
                err.http_status = 404;
                err.message = "Sorry, we can't find CartoDB user '" + cdbUsername + "'. " +
                    "Please check that you have entered the correct domain.";
                return callback(err);
            }

            if ( req.profiler ) {
                req.profiler.done('getDBParams');
            }

            dbParams = userDBParams;

            dbopts.host = dbParams.dbhost;
            dbopts.dbname = dbParams.dbname;
            dbopts.user = (!!dbParams.dbpublicuser) ? dbParams.dbpublicuser : global.settings.db_pubuser;

            authApi.verifyCredentials({
                metadataBackend: metadataBackend,
                apiKey: dbParams.apikey
            }, this);
        },
        function setDBAuth(err, isAuthenticated) {
            if (err) {
                throw err;
            }

            if ( req.profiler ) {
                req.profiler.done('authenticate');
            }

            if (_.isBoolean(isAuthenticated) && isAuthenticated) {
                dbopts.authenticated = isAuthenticated;
                dbopts.user = _.template(global.settings.db_user, {user_id: dbParams.dbuser});
                if ( global.settings.hasOwnProperty('db_user_pass') ) {
                    dbopts.pass = _.template(global.settings.db_user_pass, {
                        user_id: dbParams.dbuser,
                        user_password: dbParams.dbpass
                    });
                } else {
                    delete dbopts.pass;
                }
            }

            return dbopts;
        },
        function errorHandle(err, dbopts) {
            if (err) {
                return callback(err);
            }

            callback(null, dbopts);
        }
    );

};

module.exports = DbService;
