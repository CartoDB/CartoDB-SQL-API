'use strict';

var Ogr = require('./../ogr');

function SpatiaLiteFormat () {}

SpatiaLiteFormat.prototype = new Ogr('spatialite');

SpatiaLiteFormat.prototype._contentType = 'application/x-sqlite3; charset=utf-8';
SpatiaLiteFormat.prototype._fileExtension = 'sqlite';
// As of GDAL 1.10.1 SRID detection is bogus, so we use
// our own method. See:
//  http://trac.osgeo.org/gdal/ticket/5131
//  http://trac.osgeo.org/gdal/ticket/5287
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/110
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/116
// Bug was fixed in GDAL 1.10.2
SpatiaLiteFormat.prototype._needSRS = true;

SpatiaLiteFormat.prototype.generate = function (options, callback) {
    this.toOGR_SingleFile(options, 'SQLite', callback);
    options.cmd_params = ['SPATIALITE=yes'];
};

module.exports = SpatiaLiteFormat;
