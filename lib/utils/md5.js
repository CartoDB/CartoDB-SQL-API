'use strict';

var crypto = require('crypto');

module.exports = function generateMD5 (data) {
    var hash = crypto.createHash('md5');
    hash.update(data);
    return hash.digest('hex');
};
