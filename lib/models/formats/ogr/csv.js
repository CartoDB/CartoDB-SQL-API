'use strict';

var Ogr = require('./../ogr');
const serverOptions = require('./../../../server-options');
const { logger } = serverOptions();

function CsvFormat () {}

CsvFormat.prototype = new Ogr('csv');

CsvFormat.prototype._contentType = 'text/csv; charset=utf-8; header=present';
CsvFormat.prototype._fileExtension = 'csv';

CsvFormat.prototype.generate = function (options, callback) {
    logger.info({ custom: true }, 'Generating CSV format');

    this.toOGR_SingleFile(options, 'CSV', callback);
};

module.exports = CsvFormat;
