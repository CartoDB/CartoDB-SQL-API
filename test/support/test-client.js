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


TestClient.prototype.getResult = function(query, callback) {
    assert.response(
        this.server,
        {
            url: this.getUrl(),
            headers: {
                host: this.getHost(),
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

TestClient.prototype.getHost = function() {
    return this.config.host || 'vizzuality.cartodb.com';
};

TestClient.prototype.getUrl = function() {
    return '/api/v2/sql?api_key=' + (this.config.apiKey || '1234');
};
