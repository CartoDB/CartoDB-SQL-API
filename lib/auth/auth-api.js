'use strict';

var ApiKeyAuth = require('./apikey');
var OAuthAuth = require('./oauth');

function AuthApi (req, requestParams) {
    this.req = req;
    this.authBackend = getAuthBackend(req, requestParams);

    this._hasCredentials = null;
}

AuthApi.prototype.getType = function () {
    if (this.authBackend instanceof ApiKeyAuth) {
        return 'apiKey';
    } else if (this.authBackend instanceof OAuthAuth) {
        return 'oAuth';
    }
};

AuthApi.prototype.hasCredentials = function () {
    if (this._hasCredentials === null) {
        this._hasCredentials = this.authBackend.hasCredentials();
    }
    return this._hasCredentials;
};

AuthApi.prototype.getCredentials = function () {
    return this.authBackend.getCredentials();
};

AuthApi.prototype.verifyCredentials = function (callback) {
    if (this.hasCredentials()) {
        this.authBackend.verifyCredentials(callback);
    } else {
        callback(null, false);
    }
};

function getAuthBackend (req, requestParams) {
    if (requestParams.api_key) {
        return new ApiKeyAuth(req, requestParams.metadataBackend, requestParams.user, requestParams.api_key);
    } else {
        return new OAuthAuth(req, requestParams.metadataBackend);
    }
}

module.exports = AuthApi;
