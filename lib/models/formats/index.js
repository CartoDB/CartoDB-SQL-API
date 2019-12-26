'use strict';

var fs = require('fs');
const path = require('path');
var formats = {};

function formatFilesWithPath (dir) {
    var formatDir = path.join(__dirname, dir);
    return fs.readdirSync(formatDir).map(function (formatFile) {
        return path.join(formatDir, formatFile);
    });
}

var formatFilesPaths = []
    .concat(formatFilesWithPath('ogr'))
    .concat(formatFilesWithPath('pg'));

formatFilesPaths.forEach(function (file) {
    var format = require(file);
    formats[format.prototype.id] = format;
});

module.exports = formats;
