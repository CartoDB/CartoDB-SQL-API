var ApiKeyAuth = require('./apikey'),
    OAuthAuth  = require('./oauth');

function AuthApi(req, res, requestParams) {
    this.req = req;
    this.res = res;
    this.authBacked = getAuthBackend(req, res, requestParams);

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

AuthApi.prototype.verifyCredentials = function(options, callback) {
    if (this.hasCredentials()) {
        this.authBacked.verifyCredentials(options, callback);
    } else {
        callback(null, false);
    }
};

function getAuthBackend(req, res, requestParams) {
    if (requestParams.api_key) {
        return new ApiKeyAuth(req, res);
    } else {
        return new OAuthAuth(req);
    }
}

module.exports = AuthApi;
