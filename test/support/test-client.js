'use strict';

require('../helper');
var assert = require('assert');
var appServer = require('../../lib/server');
var redisUtils = require('./redis-utils');
const step = require('step');
const PSQL = require('cartodb-psql');
const _ = require('underscore');

function response (code) {
    return {
        status: code
    };
}

var RESPONSE = {
    OK: response(200),
    CREATED: response(201)
};

function TestClient (config) {
    this.config = config || {};
    this.server = appServer();
}

module.exports = TestClient;

TestClient.prototype.getResult = function (query, override, callback) {
    if (!callback) {
        callback = override;
        override = {};
    }

    assert.response(
        this.server,
        {
            url: this.getUrl(override),
            headers: {
                host: this.getHost(override),
                'Content-Type': this.getContentType(override),
                authorization: this.getAuthorization(override)
            },
            method: 'POST',
            data: this.getParser(override)({
                q: query,
                format: this.getFormat(override),
                filename: this.getFilename(override)
            })
        },
        this.getExpectedResponse(override),
        function (err, res) {
            if (err) {
                return callback(err);
            }
            var result = JSON.parse(res.body);

            if (res.statusCode > 299) {
                return callback(null, result, res.headers);
            }

            return callback(null, result.rows, res.headers || [], result, res.headers);
        }
    );
};

TestClient.prototype.getHost = function (override) {
    return override.host || this.config.host || 'vizzuality.cartodb.com';
};

TestClient.prototype.getAuthorization = function (override) {
    const auth = override.authorization || this.config.authorization;

    if (auth) {
        return `Basic ${Buffer.from(auth).toString('base64')}`;
    }
};

TestClient.prototype.getContentType = function (override) {
    return override['Content-Type'] || this.config['Content-Type'] || 'application/json';
};

TestClient.prototype.getParser = function (override) {
    return override.parser || this.config.parser || JSON.stringify;
};

TestClient.prototype.getUrl = function (override) {
    if (override.anonymous) {
        return '/api/v1/sql?';
    }

    let url = '/api/v2/sql?api_key=' + (override.apiKey || this.config.apiKey || '1234');
    if (override.client) {
        url = url + '&client=' + override.client;
    }
    return url;
};

TestClient.prototype.getExpectedResponse = function (override) {
    return override.response || this.config.response || RESPONSE.OK;
};

TestClient.prototype.getFormat = function (override) {
    return override.format || this.config.format || undefined;
};

TestClient.prototype.getFilename = function (override) {
    return override.filename || this.config.filename || undefined;
};

TestClient.prototype.setUserRenderTimeoutLimit = function (user, userTimeoutLimit, callback) {
    const userTimeoutLimitsKey = `limits:timeout:${user}`;
    const params = [
        userTimeoutLimitsKey,
        'render', userTimeoutLimit,
        'render_public', userTimeoutLimit
    ];

    redisUtils.configureUserMetadata('hmset', params, callback);
};

TestClient.prototype.setUserDatabaseTimeoutLimit = function (user, timeoutLimit, callback) {
    const dbname = _.template(global.settings.db_base_name, { user_id: 1 });
    const dbuser = _.template(global.settings.db_user, { user_id: 1 });
    const publicuser = global.settings.db_pubuser;

    const psql = new PSQL({
        user: 'postgres',
        dbname: dbname,
        host: global.settings.db_host,
        port: global.settings.db_port
    });

    // we need to guarantee all new connections have the new settings
    psql.end();

    step(
        function configureTimeouts () {
            const timeoutSQLs = [
                `ALTER ROLE "${publicuser}" SET STATEMENT_TIMEOUT TO ${timeoutLimit}`,
                `ALTER ROLE "${dbuser}" SET STATEMENT_TIMEOUT TO ${timeoutLimit}`,
                `ALTER DATABASE "${dbname}" SET STATEMENT_TIMEOUT TO ${timeoutLimit}`
            ];

            const group = this.group();

            timeoutSQLs.forEach(sql => psql.query(sql, group()));
        },
        callback
    );
};
