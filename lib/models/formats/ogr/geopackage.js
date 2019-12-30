'use strict';

var Ogr = require('./../ogr');

function GeoPackageFormat () {}

GeoPackageFormat.prototype = new Ogr('gpkg');

GeoPackageFormat.prototype._contentType = 'application/x-sqlite3; charset=utf-8';
GeoPackageFormat.prototype._fileExtension = 'gpkg';
// As of GDAL 1.10.1 SRID detection is bogus, so we use
// our own method. See:
//  http://trac.osgeo.org/gdal/ticket/5131
//  http://trac.osgeo.org/gdal/ticket/5287
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/110
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/116
// Bug was fixed in GDAL 1.10.2
GeoPackageFormat.prototype._needSRS = true;

GeoPackageFormat.prototype.generate = function (options, callback) {
    options.cmd_params = ['-lco', 'FID=cartodb_id'];
    this.toOGR_SingleFile(options, 'GPKG', callback);
};

module.exports = GeoPackageFormat;
