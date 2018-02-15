const basicAuth = require('basic-auth');

const apiKeyGetters = [
    getApikeyTokenFromHeaderAuthorization,
    getApikeyTokenFromRequestQueryString,
    getApikeyTokenFromRequestBody,
];

module.exports = function getApiKeyTokenFromRequest () {
    return function getApiKeyTokenFromRequestMiddleware(req, res, next) {
        let apiKeyToken = null;

        for (var getter of apiKeyGetters) {
            apiKeyToken = getter(req);
            if (apiKeyTokenFound(apiKeyToken)) {
                res.locals.api_key = apiKeyToken;
                break;
            }
        }

        next();
    };
};

function getApikeyTokenFromHeaderAuthorization(req) {
    const { pass: apiKeyToken } = basicAuth(req) || {};

    if (apiKeyToken !== undefined) {
        return apiKeyToken;
    }

    return false;
}

function getApikeyTokenFromRequestQueryString(req) {
    if (req.query.api_key) {
        return req.query.api_key;
    }

    if (req.query.map_key) {
        return req.query.map_key;
    }

    return false;
}

function getApikeyTokenFromRequestBody(req) {
    if (req.body && req.body.api_key) {
        return req.body.api_key;
    }

    if (req.body && req.body.map_key) {
        return req.body.map_key;
    }

    return false;
}

function apiKeyTokenFound(apiKeyToken) {
    return !!apiKeyToken;
}
