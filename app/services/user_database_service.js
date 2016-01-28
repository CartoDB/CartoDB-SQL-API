'use strict';

var step = require('step');
var _ = require('underscore');

function UserDatabaseService(metadataBackend) {
    this.metadataBackend = metadataBackend;
}

/**
 * Callback is invoked with `dbParams` and `authDbParams`.
 * `dbParams` depends on AuthApi verification so it might return a public user with just SELECT permission, where
 * `authDbParams` will always return connection params as AuthApi had authorized the connection.
 * That might be useful when you have to run a query with and without permissions.
 *
 * @param {AuthApi} authApi
 * @param {String} cdbUsername
 * @param {Function} callback (err, dbParams, authDbParams)
 */
UserDatabaseService.prototype.getConnectionParams = function (authApi, cdbUsername, callback) {
    var self = this;

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
            var next = this;

            // If the request is providing credentials it may require every DB parameters
            if (authApi.hasCredentials()) {
                self.metadataBackend.getAllUserDBParams(cdbUsername, next);
            } else {
                self.metadataBackend.getUserDBPublicConnectionParams(cdbUsername, next);
            }
        },
        function authenticate(err, userDBParams) {
            var next = this;

            if (err) {
                err.http_status = 404;
                err.message = "Sorry, we can't find CartoDB user '" + cdbUsername + "'. " +
                    "Please check that you have entered the correct domain.";
                return callback(err);
            }

            dbParams = userDBParams;

            dbopts.host = dbParams.dbhost;
            dbopts.dbname = dbParams.dbname;
            dbopts.user = (!!dbParams.dbpublicuser) ? dbParams.dbpublicuser : global.settings.db_pubuser;

            authApi.verifyCredentials({
                metadataBackend: self.metadataBackend,
                apiKey: dbParams.apikey
            }, next);
        },
        function setDBAuth(err, isAuthenticated) {
            if (err) {
                throw err;
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

            callback(null, dbopts, dbopts);
        }
    );

};

module.exports = UserDatabaseService;
