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
            self.metadataBackend.getAllUserDBParams(cdbUsername, this);
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
        function getUserLimits (err, isAuthenticated) {
            var next = this;

            if (err) {
                return next(err);
            }

            self.metadataBackend.getUserTimeoutRenderLimits(cdbUsername, function (err, timeoutRenderLimit) {
                if (err) {
                    return next(err);
                }

                var userLimits = {
                    timeout: isAuthenticated ? timeoutRenderLimit.render : timeoutRenderLimit.renderPublic
                };

                next(null, isAuthenticated, userLimits);
            });
        },
        function setDBAuth(err, isAuthenticated, userLimits) {
            if (err) {
                throw err;
            }

            var user = _.template(global.settings.db_user, {user_id: dbParams.dbuser});
            var pass = null;
            if (global.settings.hasOwnProperty('db_user_pass')) {
                pass = _.template(global.settings.db_user_pass, {
                    user_id: dbParams.dbuser,
                    user_password: dbParams.dbpass
                });
            }

            if (_.isBoolean(isAuthenticated) && isAuthenticated) {
                dbopts.authenticated = isAuthenticated;
                dbopts.user = user;
                dbopts.pass = pass;
            }

            var authDbOpts = _.defaults({user: user, pass: pass}, dbopts);

            return this(null, dbopts, authDbOpts, userLimits);
        },
        function errorHandle(err, dbopts, authDbOpts, userLimits) {
            if (err) {
                return callback(err);
            }

            callback(null, dbopts, authDbOpts, userLimits);
        }
    );

};

module.exports = UserDatabaseService;
