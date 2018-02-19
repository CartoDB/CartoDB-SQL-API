const AuthApi = require('../auth/auth_api');
const basicAuth = require('basic-auth');

module.exports = function authenticatedRequest (userDatabaseService, forceToBeAuthenticated = false) {
    return function authenticatedRequestMiddleware (req, res, next) {
        const { user } = res.locals;
        const credentials = getCredentialsFromRequest(req, user);

        if (!userMatches(credentials, user)) {
            return next(new Error('permission denied'));
        }

        res.locals.api_key = credentials.apiKeyToken;

        const params = Object.assign({}, res.locals, req.query, req.body);
        const authApi = new AuthApi(req, res, params);

        userDatabaseService.getConnectionParams(authApi, user, function (err, dbParams, authDbParams, userLimits) {
            if (req.profiler) {
                req.profiler.done('setDBAuth');
            }

            if (err) {
                return next(err);
            }

            if (forceToBeAuthenticated && !dbParams.authenticated) {
                return next(new Error('permission denied'));
            }

            res.locals.userDbParams = dbParams;
            res.locals.authDbParams = authDbParams;
            res.locals.userLimits = userLimits;

            next();
        });
    };
};

const credentialsGetters = [
    getCredentialsFromHeaderAuthorization,
    getCredentialsFromRequestQueryString,
    getCredentialsFromRequestBody,
];

function getCredentialsFromRequest (req) {
    let credentials = null;

    for (var getter of credentialsGetters) {
        credentials = getter(req);

        if (apiKeyTokenFound(credentials)) {
            break;
        }
    }

    return credentials;
}

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
    return !(credentials.user !== undefined && credentials.user !== user);
}
