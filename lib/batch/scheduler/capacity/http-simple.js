'use strict';

var request = require('request');
var debug = require('../../util/debug')('capacity-http-simple');

function HttpSimpleCapacity (host, capacityEndpoint) {
    this.host = host;
    this.capacityEndpoint = capacityEndpoint;

    this.lastResponse = null;
    this.lastResponseTime = 0;
}

module.exports = HttpSimpleCapacity;

HttpSimpleCapacity.prototype.getCapacity = function (callback) {
    this.getResponse(function (err, values) {
        var capacity = 1;

        if (err) {
            return callback(null, capacity);
        }

        var availableCores = parseInt(values.available_cores, 10);

        capacity = Math.max(availableCores, 1);
        capacity = Number.isFinite(capacity) ? capacity : 1;

        debug('host=%s, capacity=%s', this.host, capacity);
        return callback(null, capacity);
    }.bind(this));
};

HttpSimpleCapacity.prototype.getResponse = function (callback) {
    var requestParams = {
        method: 'POST',
        url: this.capacityEndpoint,
        timeout: 2000,
        json: true
    };
    debug('getCapacity(%s)', this.host);

    // throttle requests for 500 ms
    var now = Date.now();
    if (this.lastResponse !== null && ((now - this.lastResponseTime) < 500)) {
        return callback(null, this.lastResponse);
    }

    request.post(requestParams, function (err, res, jsonRes) {
        if (err) {
            return callback(err);
        }
        if (jsonRes && jsonRes.retcode === 0) {
            this.lastResponse = jsonRes.return_values || {};
            // We could go more aggressive by updating lastResponseTime on failures.
            this.lastResponseTime = now;

            return callback(null, this.lastResponse);
        }
        return callback(new Error('Could not retrieve information from endpoint'));
    }.bind(this));
};
