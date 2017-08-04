'use strict';

require('../helper');
var assert = require('assert');
var appServer = require('../../app/server');

function response(code) {
    return {
        status: code
    };
}

var RESPONSE = {
    OK: response(200),
    CREATED: response(201)
};


function TestClient(config) {
    this.config = config || {};
    this.server = appServer();
}

module.exports = TestClient;


TestClient.prototype.getResult = function(query, override, callback) {
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
                'Content-Type': this.getContentType(override)
            },
            method: 'POST',
            data: this.getParser(override)({
                q: query,
                format: this.getFormat(override)
            })
        },
        this.getExpectedResponse(override),
        function (err, res) {
            if (err) {
                return callback(err);
            }
            var result = JSON.parse(res.body);

            if (res.statusCode > 299) {
                return callback(null, result);
            }

            return callback(null, result.rows || []);
        }
    );
};

TestClient.prototype.getHost = function(override) {
    return override.host || this.config.host || 'vizzuality.cartodb.com';
};

TestClient.prototype.getContentType = function(override) {
    return override['Content-Type'] || this.config['Content-Type'] || 'application/json';
};

TestClient.prototype.getParser = function (override) {
    return override.parser || this.config.parser || JSON.stringify
}

TestClient.prototype.getUrl = function(override) {
    if (override.anonymous) {
        return '/api/v1/sql?';
    }

    return '/api/v2/sql?api_key=' + (override.apiKey || this.config.apiKey || '1234');
};

TestClient.prototype.getExpectedResponse = function (override) {
    return override.response || this.config.response || RESPONSE.OK;
};

TestClient.prototype.getFormat = function (override) {
    return override.format || this.config.format || undefined;
};


