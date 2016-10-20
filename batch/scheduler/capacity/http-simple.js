'use strict';

var request = require('request');
var debug = require('../../util/debug')('capacity-http-simple');

function HttpSimpleCapacity(host, capacityEndpoint) {
    this.host = host;
    this.capacityEndpoint = capacityEndpoint;
}

module.exports = HttpSimpleCapacity;

HttpSimpleCapacity.prototype.getCapacity = function(callback) {
    this.getResponse(function(err, values) {
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

HttpSimpleCapacity.prototype.getResponse = function(callback) {
    var requestParams = {
        method: 'POST',
        url: this.capacityEndpoint,
        timeout: 2000,
        json: true
    };
    debug('getCapacity(%s)', this.host);
    request.post(requestParams, function(err, res, jsonRes) {
        if (err) {
            return callback(err);
        }
        if (jsonRes && jsonRes.retcode === 0) {
            return callback(null, jsonRes.return_values || {});
        }
        return callback(new Error('Could not retrieve information from endpoint'));
    });
};
