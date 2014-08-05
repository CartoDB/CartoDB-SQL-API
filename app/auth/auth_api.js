var ApiKeyAuth = require('./apikey'),
    OAuthAuth  = require('./oauth');

function AuthApi(req, requestParams) {
    this.req = req;
    this.authBacked = getAuthBackend(req, requestParams);

    this._hasCredentials = null;
}

AuthApi.prototype.hasCredentials = function() {
    if (this._hasCredentials === null) {
        this._hasCredentials = this.authBacked.hasCredentials();
    }
    return this._hasCredentials;
};

AuthApi.prototype.verifyCredentials = function(options, callback) {
    if (this.hasCredentials()) {
        this.authBacked.verifyCredentials(options, callback);
    } else {
        callback(null, false);
    }
};

function getAuthBackend(req, requestParams) {
    if (requestParams.api_key) {
        return new ApiKeyAuth(req);
    } else {
        return new OAuthAuth(req);
    }
}

module.exports = AuthApi;
