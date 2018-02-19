const basicAuth = require('basic-auth');

const credentialsGetters = [
    getCredentialsFromHeaderAuthorization,
    getCredentialsFromRequestQueryString,
    getCredentialsFromRequestBody,
];

module.exports = function getCredentials () {
    return function getCredentialsMiddleware(req, res, next) {
        let credentials = null;

        for (var getter of credentialsGetters) {
            credentials = getter(req);

            if (apiKeyTokenFound(credentials)) {
                res.locals.api_key = credentials.apiKeyToken;
                break;
            }
        }

        if (userMatches(credentials, res.locals.user)) {
            return next(new Error('permission denied'));
        }

        next();
    };
};

function getCredentialsFromHeaderAuthorization(req) {
    const { pass, name } = basicAuth(req) || {};

    if (pass !== undefined && name !== undefined) {
        return {
            apiKeyToken: pass,
            user: name
        };
    }

    return false;
}

function getCredentialsFromRequestQueryString(req) {
    if (req.query.api_key) {
        return {
            apiKeyToken: req.query.api_key
        };
    }

    if (req.query.map_key) {
        return {
            apiKeyToken: req.query.map_key
        };
    }

    return false;
}

function getCredentialsFromRequestBody(req) {
    if (req.body && req.body.api_key) {
        return {
            apiKeyToken: req.body.api_key
        };
    }

    if (req.body && req.body.map_key) {
        return {
            apiKeyToken: req.body.map_key
        };
    }

    return false;
}

function apiKeyTokenFound(credentials) {
    if (typeof credentials === 'boolean') {
        return credentials;
    }

    if (credentials.apiKeyToken !== undefined) {
        return true;
    }

    return false;
}

function userMatches (credentials, user) {
    return (credentials.user !== undefined && credentials.user !== user);
}
