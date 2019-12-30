'use strict';

function FixedCapacity (capacity) {
    this.capacity = Math.max(1, capacity);
}

module.exports = FixedCapacity;

FixedCapacity.prototype.getCapacity = function (callback) {
    return callback(null, this.capacity);
};
