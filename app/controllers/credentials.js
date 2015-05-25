var _ = require('underscore');
var assert = require('assert');
var step = require('step');

var AuthApi = require('../auth/auth_api');
var Credentials = require('../models/credentials');

function CredentialsController(cdbReq, metadataBackend) {
    this.cdbReq = cdbReq;
    this.metadataBackend = metadataBackend;
}

module.exports = CredentialsController;

CredentialsController.prototype.register = function(app) {
    var credentialsEndpoint = global.settings.base_url + '/sql/credentials';
    app.all(credentialsEndpoint, this.bootstrap.bind(this));
    app.all(credentialsEndpoint, this.authenticate.bind(this));
    app.get(credentialsEndpoint,  this.get.bind(this));
};

CredentialsController.prototype.bootstrap = function(req, res, next) {
    req.context = {};
    return next();
};

CredentialsController.prototype.authenticate = function(req, res, next) {
    var self = this;

    var authApi = new AuthApi(req, _.extend({}, req.query, req.body || {}));

    if (!authApi.hasCredentials()) {
        return res.send({error: 'Authorization required'}, 401);
    }

    var cdbUsername = this.cdbReq.userByReq(req);

    var dbParams = {};

    step(
        function getDatabaseConnectionParams() {
            self.metadataBackend.getAllUserDBParams(cdbUsername, this);
        },
        function authenticate(err, userDbParams) {
            assert.ifError(err);

            dbParams = userDbParams;

            authApi.verifyCredentials({
                metadataBackend: self.metadataBackend,
                apiKey: userDbParams.apikey
            }, this);
        },
        function handleAuthentication(err, isAuthenticated) {
            assert.ifError(err);

            if (_.isBoolean(isAuthenticated) && isAuthenticated) {
                return dbParams;
            } else {
                throw new Error('Authorization required');
            }
        },
        function finish(err, dbParams) {
            if (err) {
                return res.send({error: 'Authorization required'}, 401);
            }

            req.context.dbParams = dbParams;

            return next();
        }
    );
};

CredentialsController.prototype.get = function(req, res) {
    var format = req.query.format || 'json';

    if (!Credentials.formatters[format]) {
        return res.send({error: 'Invalid format ' + format}, 400);
    }

    var dbParams = req.context.dbParams;

    var credentials = new Credentials({
        host: dbParams.dbhost,
        port: dbParams.dbport || 5432,
        user: _.template(global.settings.db_user, {user_id: dbParams.dbuser}),
        password: _.template(global.settings.db_user_pass, {user_id: dbParams.dbuser, user_password: dbParams.dbpass}),
        dbname: dbParams.dbname
    });

    var formatter = new Credentials.formatters[format](credentials);

    return res.send(formatter.getCredentials(), {
        'Content-Type': formatter.getContentType()
    }, 200);
};
