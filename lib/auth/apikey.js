'use strict';

/**
 * this module allows to auth user using an pregenerated api key
 */
function ApikeyAuth (req, metadataBackend, username, apikeyToken) {
    this.req = req;
    this.metadataBackend = metadataBackend;
    this.username = username;
    this.apikeyToken = apikeyToken;
}

module.exports = ApikeyAuth;

function usernameMatches (basicAuthUsername, requestUsername) {
    return !(basicAuthUsername && (basicAuthUsername !== requestUsername));
}

ApikeyAuth.prototype.verifyCredentials = function (callback) {
    this.metadataBackend.getApikey(this.username, this.apikeyToken, (err, apikey) => {
        if (err) {
            err.http_status = 500;
            err.message = 'Unexpected error';

            return callback(err);
        }

        if (isApiKeyFound(apikey)) {
            if (!usernameMatches(apikey.user, this.username)) {
                const usernameError = new Error('Forbidden');
                usernameError.type = 'auth';
                usernameError.subtype = 'api-key-username-mismatch';
                usernameError.http_status = 403;

                return callback(usernameError);
            }

            if (!apikey.grantsSql) {
                const forbiddenError = new Error('forbidden');
                forbiddenError.http_status = 403;

                return callback(forbiddenError);
            }

            return callback(null, getAuthorizationLevel(apikey));
        } else {
            const apiKeyNotFoundError = new Error('Unauthorized');
            apiKeyNotFoundError.type = 'auth';
            apiKeyNotFoundError.subtype = 'api-key-not-found';
            apiKeyNotFoundError.http_status = 401;

            return callback(apiKeyNotFoundError);
        }
    });
};

ApikeyAuth.prototype.hasCredentials = function () {
    return !!this.apikeyToken;
};

ApikeyAuth.prototype.getCredentials = function () {
    return this.apikeyToken;
};

function getAuthorizationLevel (apikey) {
    return apikey.type;
}

function isApiKeyFound (apikey) {
    return apikey.type !== null &&
        apikey.user !== null &&
        apikey.databasePassword !== null &&
        apikey.databaseRole !== null;
}
