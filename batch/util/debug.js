'use strict';

var debug = require('debug');

module.exports = function batchDebug (ns) {
    return debug(['batch', ns].join(':'));
};
