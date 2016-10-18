'use strict';

function InfinityCapacity() {

}

module.exports = InfinityCapacity;

InfinityCapacity.prototype.getCapacity = function(callback) {
    return callback(null, Infinity);
};
