'use strict';

var Ogr = require('./../ogr');
var serverOptions = require('./../../../server-options');

function CsvFormat () {}

CsvFormat.prototype = new Ogr('csv');

CsvFormat.prototype._contentType = 'text/csv; charset=utf-8; header=present';
CsvFormat.prototype._fileExtension = 'csv';

CsvFormat.prototype.generate = function (options, callback) {
    this.toOGR_SingleFile(options, 'CSV', callback);
};

module.exports = CsvFormat;
