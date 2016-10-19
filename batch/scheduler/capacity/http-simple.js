'use strict';

var request = require('request');
var debug = require('../../util/debug')('capacity-http');

function HttpSimpleCapacity(host, capacityEndpoint) {
    this.host = host;
    this.capacityEndpoint = capacityEndpoint;
}

module.exports = HttpSimpleCapacity;

HttpSimpleCapacity.prototype.getCapacity = function(callback) {
    var requestParams = {
        method: 'POST',
        url: this.capacityEndpoint,
        json: true
    };
    debug('getCapacity(%s)', this.host);
    request.post(requestParams, function(err, res, jsonRes) {
        var capacity = 1;

        if (!err && jsonRes) {
            if (jsonRes.retcode === 0) {
                var values = jsonRes.return_values;

                var cores = parseInt(values.cores, 10);
                var relativeLoad = parseFloat(values.relative_load);

                capacity = Math.max(
                    Math.floor(((1 - relativeLoad) * cores) - 1),
                    1
                );

                debug('host=%s, capacity=%s', this.host, capacity);
            }
        }

        debug('host=%s, capacity=%s', this.host, capacity);
        return callback(null, capacity);
    }.bind(this));
};
