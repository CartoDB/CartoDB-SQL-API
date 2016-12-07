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
                'Content-Type': 'application/json'
            },
            method: 'POST',
            data: JSON.stringify({
                q: query
            })
        },
        RESPONSE.OK,
        function (err, res) {
            if (err) {
                return callback(err);
            }
            var result = JSON.parse(res.body);

            return callback(null, result.rows || []);
        }
    );
};

TestClient.prototype.getHost = function(override) {
    return override.host || this.config.host || 'vizzuality.cartodb.com';
};

TestClient.prototype.getUrl = function(override) {
    return '/api/v2/sql?api_key=' + (override.apiKey || this.config.apiKey || '1234');
};
