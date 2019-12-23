'use strict';

function isApiKeyFound (apikey) {
    return apikey.type !== null &&
        apikey.user !== null &&
        apikey.databasePassword !== null &&
        apikey.databaseRole !== null;
}

function UserDatabaseService (metadataBackend) {
    this.metadataBackend = metadataBackend;
}

function errorUserNotFoundMessageTemplate (user) {
    return `Sorry, we can't find CARTO user '${user}'. Please check that you have entered the correct domain.`;
}

function isOauthAuthorization ({ apikeyToken, authorizationLevel }) {
    return (authorizationLevel === 'master') && !apikeyToken;
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
UserDatabaseService.prototype.getConnectionParams = function (username, apikeyToken, authorizationLevel, callback) {
    this.metadataBackend.getAllUserDBParams(username, (err, dbParams) => {
        if (err) {
            err.http_status = 404;
            err.message = errorUserNotFoundMessageTemplate(username);

            return callback(err);
        }

        const commonDBConfiguration = {
            port: global.settings.db_port,
            host: dbParams.dbhost,
            dbname: dbParams.dbname
        };

        this.metadataBackend.getMasterApikey(username, (err, masterApikey) => {
            if (err) {
                err.http_status = 404;
                err.message = errorUserNotFoundMessageTemplate(username);

                return callback(err);
            }

            if (!isApiKeyFound(masterApikey)) {
                const apiKeyNotFoundError = new Error('Unauthorized');
                apiKeyNotFoundError.type = 'auth';
                apiKeyNotFoundError.subtype = 'api-key-not-found';
                apiKeyNotFoundError.http_status = 401;

                return callback(apiKeyNotFoundError);
            }

            const masterDBConfiguration = Object.assign({
                user: masterApikey.databaseRole,
                pass: masterApikey.databasePassword
            },
            commonDBConfiguration);

            if (isOauthAuthorization({ apikeyToken, authorizationLevel })) {
                return callback(null, masterDBConfiguration, masterDBConfiguration);
            }

            // Default Api key fallback
            apikeyToken = apikeyToken || 'default_public';

            this.metadataBackend.getApikey(username, apikeyToken, (err, apikey) => {
                if (err) {
                    err.http_status = 404;
                    err.message = errorUserNotFoundMessageTemplate(username);

                    return callback(err);
                }

                if (!isApiKeyFound(apikey)) {
                    const apiKeyNotFoundError = new Error('Unauthorized');
                    apiKeyNotFoundError.type = 'auth';
                    apiKeyNotFoundError.subtype = 'api-key-not-found';
                    apiKeyNotFoundError.http_status = 401;

                    return callback(apiKeyNotFoundError);
                }

                const DBConfiguration = Object.assign({
                    user: apikey.databaseRole,
                    pass: apikey.databasePassword
                },
                commonDBConfiguration);

                callback(null, DBConfiguration, masterDBConfiguration);
            });
        });
    });
};

module.exports = UserDatabaseService;
