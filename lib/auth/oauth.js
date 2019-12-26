'use strict';

// too bound to the request object, but ok for now
var _ = require('underscore');
var OAuthUtil = require('oauth-client');
var step = require('step');
var CdbRequest = require('../models/cartodb-request');
var cdbReq = new CdbRequest();

var oAuth = (function () {
    var me = {
        oauth_database: 3,
        oauth_user_key: 'rails:oauth_access_tokens:<%= oauth_access_key %>',
        is_oauth_request: true
    };

    // oauth token cases:
    // * in GET request
    // * in header
    me.parseTokens = function (req) {
        var queryOauth = _.clone(req.method === 'POST' ? req.body : req.query);
        var headerOauth = {};
        var oauthVariables = ['oauth_body_hash',
            'oauth_consumer_key',
            'oauth_token',
            'oauth_signature_method',
            'oauth_signature',
            'oauth_timestamp',
            'oauth_nonce',
            'oauth_version'];

        // pull only oauth tokens out of query
        var nonOauth = _.difference(_.keys(queryOauth), oauthVariables);
        _.each(nonOauth, function (key) { delete queryOauth[key]; });

        // pull oauth tokens out of header
        var headerString = req.headers.authorization;
        if (!_.isUndefined(headerString)) {
            _.each(oauthVariables, function (oauthKey) {
                var matchedString = headerString.match(new RegExp(oauthKey + '="([^"]+)"'));
                if (!_.isNull(matchedString)) {
                    headerOauth[oauthKey] = decodeURIComponent(matchedString[1]);
                }
            });
        }

        // merge header and query oauth tokens. preference given to header oauth
        return _.defaults(headerOauth, queryOauth);
    };

    // remove oauthy tokens from an object
    me.splitParams = function (obj) {
        var removed = null;
        for (var prop in obj) {
            if (/^oauth_\w+$/.test(prop)) {
                if (!removed) {
                    removed = {};
                }
                removed[prop] = obj[prop];
                delete obj[prop];
            }
        }
        return removed;
    };

    me.getAllowedHosts = function () {
        var oauthConfig = global.settings.oauth || {};
        return oauthConfig.allowedHosts || ['carto.com', 'cartodb.com'];
    };

    // do new fancy get User ID
    me.verifyRequest = function (req, metadataBackend, callback) {
        var that = this;
        // TODO: review this
        var httpProto = req.protocol;
        if (!httpProto || (httpProto !== 'http' && httpProto !== 'https')) {
            var msg = 'Unknown HTTP protocol ' + httpProto + '.';
            var unknownProtocolErr = new Error(msg);
            unknownProtocolErr.http_status = 500;
            return callback(unknownProtocolErr);
        }

        var username = cdbReq.userByReq(req);
        var requestTokens;
        var signature;

        step(
            function getTokensFromURL () {
                return oAuth.parseTokens(req);
            },
            function getOAuthHash (err, _requestTokens) {
                if (err) {
                    throw err;
                }

                // this is oauth request only if oauth headers are present
                this.is_oauth_request = !_.isEmpty(_requestTokens);

                if (this.is_oauth_request) {
                    requestTokens = _requestTokens;
                    that.getOAuthHash(metadataBackend, requestTokens.oauth_token, this);
                } else {
                    return null;
                }
            },
            function regenerateSignature (err, oAuthHash) {
                if (err) {
                    throw err;
                }
                if (!this.is_oauth_request) {
                    return null;
                }

                var consumer = OAuthUtil.createConsumer(oAuthHash.consumer_key, oAuthHash.consumer_secret);
                var accessToken = OAuthUtil.createToken(oAuthHash.access_token_token, oAuthHash.access_token_secret);
                var signer = OAuthUtil.createHmac(consumer, accessToken);

                var method = req.method;
                var hostsToValidate = {};
                var requestHost = req.headers.host;
                hostsToValidate[requestHost] = true;
                that.getAllowedHosts().forEach(function (allowedHost) {
                    hostsToValidate[username + '.' + allowedHost] = true;
                });

                that.splitParams(req.query);
                // remove oauth_signature from body
                if (req.body) {
                    delete req.body.oauth_signature;
                }
                signature = requestTokens.oauth_signature;
                // remove signature from requestTokens
                delete requestTokens.oauth_signature;
                var requestParams = _.extend({}, req.body, requestTokens, req.query);

                var hosts = Object.keys(hostsToValidate);
                var requestSignatures = hosts.map(function (host) {
                    var url = httpProto + '://' + host + req.path;
                    return signer.sign(method, url, requestParams);
                });

                return requestSignatures.reduce(function (validSignature, requestSignature) {
                    if (signature === requestSignature && !_.isUndefined(requestSignature)) {
                        validSignature = true;
                    }
                    return validSignature;
                }, false);
            },
            function finishValidation (err, hasValidSignature) {
                const authorizationLevel = hasValidSignature ? 'master' : null;
                return callback(err, authorizationLevel);
            }
        );
    };

    me.getOAuthHash = function (metadataBackend, oAuthAccessKey, callback) {
        metadataBackend.getOAuthHash(oAuthAccessKey, callback);
    };

    return me;
})();

function OAuthAuth (req, metadataBackend) {
    this.req = req;
    this.metadataBackend = metadataBackend;
    this.isOAuthRequest = null;
}

OAuthAuth.prototype.verifyCredentials = function (callback) {
    if (this.hasCredentials()) {
        oAuth.verifyRequest(this.req, this.metadataBackend, callback);
    } else {
        callback(null, false);
    }
};

OAuthAuth.prototype.getCredentials = function () {
    return oAuth.parseTokens(this.req);
};

OAuthAuth.prototype.hasCredentials = function () {
    if (this.isOAuthRequest === null) {
        var passedTokens = oAuth.parseTokens(this.req);
        this.isOAuthRequest = !_.isEmpty(passedTokens);
    }

    return this.isOAuthRequest;
};

module.exports = OAuthAuth;
module.exports.backend = oAuth;
