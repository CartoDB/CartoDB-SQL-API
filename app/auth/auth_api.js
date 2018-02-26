var ApiKeyAuth = require('./apikey'),
    OAuthAuth  = require('./oauth');

function AuthApi(req, requestParams) {
    this.req = req;
    this.authBacked = getAuthBackend(req, requestParams);

    this._hasCredentials = null;
}

AuthApi.prototype.getType = function () {
    if (this.authBacked instanceof ApiKeyAuth) {
        return 'apiKey';
    } else if (this.authBacked instanceof OAuthAuth) {
        return 'oAuth';
    }
};

AuthApi.prototype.hasCredentials = function() {
    if (this._hasCredentials === null) {
        this._hasCredentials = this.authBacked.hasCredentials();
    }
    return this._hasCredentials;
};

AuthApi.prototype.getCredentials = function() {
    return this.authBacked.getCredentials();
};

AuthApi.prototype.verifyCredentials = function(callback) {
    if (this.hasCredentials()) {
        this.authBacked.verifyCredentials(callback);
    } else {
        callback(null, false);
    }
};

function getAuthBackend(req, requestParams) {
    if (requestParams.api_key) {
        return new ApiKeyAuth(req, requestParams.metadataBackend, requestParams.user, requestParams.api_key);
    } else {
        return new OAuthAuth(req, requestParams.metadataBackend);
    }
}

module.exports = AuthApi;
