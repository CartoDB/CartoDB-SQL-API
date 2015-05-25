var _ = require('underscore');

var requiredProperties = {
    host: _.isString,
    port: _.isNumber,
    user: _.isString,
    password: _.isString,
    dbname: _.isString
};

function Credentials(credentials) {
    if (!_.isObject(credentials)) {
        throw new Error('credentials param must be an object');
    }

    _.each(requiredProperties, function(validationFn, credentialKey) {
        if (!validationFn.apply(_, [credentials[credentialKey]])) {
            throw new Error('Invalid or missing credential ' + credentialKey);
        }
    });

    this.credentials = credentials;
}

module.exports = Credentials;
module.exports.formatters = {
    json: require('./json_formatter'),
    string: require('./string_formatter'),
    uri: require('./uri_formatter')
};


Credentials.prototype.getHost = function() {
    return this.credentials.host;
};

Credentials.prototype.getPort = function() {
    return this.credentials.port;
};

Credentials.prototype.getUser = function() {
    return this.credentials.user;
};

Credentials.prototype.getPassword = function() {
    return this.credentials.password;
};

Credentials.prototype.getDbName = function() {
    return this.credentials.dbname;
};

Credentials.prototype.getRaw = function() {
    return this.credentials;
};
