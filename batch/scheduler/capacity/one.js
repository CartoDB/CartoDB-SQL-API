'use strict';

function OneCapacity() {

}

module.exports = OneCapacity;

OneCapacity.prototype.getCapacity = function(callback) {
    return callback(null, 1);
};
