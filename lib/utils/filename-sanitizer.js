'use strict';

var path = require('path');

module.exports = function sanitizeFilename (filename) {
    filename = path.basename(filename, path.extname(filename));
    filename = filename.replace(/[;()\[\]<>'"\s]/g, '_'); // eslint-disable-line no-useless-escape
    return filename;
};
