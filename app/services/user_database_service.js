'use strict';

var _ = require('underscore');

function isApiKeyFound(apikey) {
    return apikey.type !== null &&
        apikey.user !== null &&
        apikey.databasePassword !== null &&
        apikey.databaseRole !== null;
}

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
UserDatabaseService.prototype.getConnectionParams = function (cdbUsername, apikeyToken, isAuthenticated, callback) {
    this.metadataBackend.getAllUserDBParams(cdbUsername, (err, dbParams) => {
        if (err) {
            err.http_status = 404;
            err.message = "Sorry, we can't find CartoDB user '" + cdbUsername + "'. " +
                "Please check that you have entered the correct domain.";
            return callback(err);
        }

        const dbopts = {
            port: global.settings.db_port,
            pass: global.settings.db_pubuser_pass
        };

        dbopts.host = dbParams.dbhost;
        dbopts.dbname = dbParams.dbname;
        dbopts.user = (!!dbParams.dbpublicuser) ? dbParams.dbpublicuser : global.settings.db_pubuser;

        var user = _.template(global.settings.db_user, {user_id: dbParams.dbuser});
        var pass = null;

        if (global.settings.hasOwnProperty('db_user_pass')) {
            pass = _.template(global.settings.db_user_pass, {
                user_id: dbParams.dbuser,
                user_password: dbParams.dbpass
            });
        }

        if (isAuthenticated) {
            dbopts.user = user;
            dbopts.pass = pass;
        }

        let authDbOpts = _.defaults({ user: user, pass: pass }, dbopts);

        if (!apikeyToken) {
            return callback(null, dbopts, authDbOpts);
        }

        this.metadataBackend.getApikey(cdbUsername, apikeyToken, (err, apikey) => {
            if (err) {
                err.http_status = 404;
                err.message = "Sorry, we can't find CartoDB user '" + cdbUsername + "'. " +
                    "Please check that you have entered the correct domain.";
                return callback(err);
            }

            if (!isApiKeyFound(apikey)) {
                return callback(null, dbopts, authDbOpts);
            }

            dbopts.user = apikey.databaseRole;
            dbopts.pass = apikey.databasePassword;

            authDbOpts = _.defaults({ user: user, pass: pass }, dbopts);

            callback(null, dbopts, authDbOpts);
        });
    });
};

module.exports = UserDatabaseService;
