'use strict';

var path = require('path');

module.exports = function sanitize_filename (filename) {
    filename = path.basename(filename, path.extname(filename));
    filename = filename.replace(/[;()\[\]<>'"\s]/g, '_');
    return filename;
};
