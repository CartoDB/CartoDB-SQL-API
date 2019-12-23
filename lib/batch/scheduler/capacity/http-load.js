'use strict';

var util = require('util');
var debug = require('../../util/debug')('capacity-http-load');
var HttpSimpleCapacity = require('./http-simple');

function HttpLoadCapacity (host, capacityEndpoint) {
    HttpSimpleCapacity.call(this, host, capacityEndpoint);
}
util.inherits(HttpLoadCapacity, HttpSimpleCapacity);

module.exports = HttpLoadCapacity;

HttpLoadCapacity.prototype.getCapacity = function (callback) {
    this.getResponse(function (err, values) {
        var capacity = 1;

        if (err) {
            return callback(null, capacity);
        }

        var cores = parseInt(values.cores, 10);
        var relativeLoad = parseFloat(values.relative_load);

        capacity = Math.max(1, Math.floor(((1 - relativeLoad) * cores) - 1));

        capacity = Number.isFinite(capacity) ? capacity : 1;

        debug('host=%s, capacity=%s', this.host, capacity);
        return callback(null, capacity);
    }.bind(this));
};
