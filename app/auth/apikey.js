/**
 * this module allows to auth user using an pregenerated api key
 */
function ApikeyAuth(req, metadataBackend, username, apikey) {
    this.req = req;
    this.metadataBackend = metadataBackend;
    this.username = username;
    this.apikey = apikey;
}

module.exports = ApikeyAuth;

function errorUserNotFoundMessageTemplate (user) {
    return `Sorry, we can't find CARTO user '${user}'. Please check that you have entered the correct domain.`;
}

ApikeyAuth.prototype.verifyCredentials = function (options, callback) {
    this.metadataBackend.getApikey(this.username, this.apikey, (err, apikey) => {
        if (err) {
            err.http_status = 404;
            err.message = errorUserNotFoundMessageTemplate(this.username);

            return callback(err);
        }

        if (isApiKeyFound(apikey)) {
            if (!apikey.grantsSql) {
                const forbiddenError = new Error('forbidden');
                forbiddenError.http_status = 403;

                return callback(forbiddenError);
            }

            return callback(null, verifyRequest(this.apikey, this.apikey));
        }

        // Auth API Fallback
        this.metadataBackend.getAllUserDBParams(this.username, (err, dbParams) => {
            if (err) {
                err.http_status = 404;
                err.message = errorUserNotFoundMessageTemplate(this.username);

                return callback(err);
            }

            callback(null, verifyRequest(this.apikey, dbParams.apikey));
        });
    });
};

ApikeyAuth.prototype.hasCredentials = function () {
    return !!this.apikey;
};

ApikeyAuth.prototype.getCredentials = function () {
    return this.apikey;
};

function verifyRequest(apikey, requiredApikey) {
    return (apikey === requiredApikey && apikey !== 'default_public');
}

function isApiKeyFound(apikey) {
    return apikey.type !== null &&
        apikey.user !== null &&
        apikey.databasePassword !== null &&
        apikey.databaseRole !== null;
}
