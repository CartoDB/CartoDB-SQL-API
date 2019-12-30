'use strict';

var Ogr = require('./../ogr');

function KmlFormat () {}

KmlFormat.prototype = new Ogr('kml');

KmlFormat.prototype._contentType = 'application/kml; charset=utf-8';
KmlFormat.prototype._fileExtension = 'kml';
// As of GDAL 1.10.1 SRID detection is bogus, so we use
// our own method. See:
//  http://trac.osgeo.org/gdal/ticket/5131
//  http://trac.osgeo.org/gdal/ticket/5287
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/110
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/116
// Bug was fixed in GDAL 1.10.2
KmlFormat.prototype._needSRS = true;

KmlFormat.prototype.generate = function (options, callback) {
    this.toOGR_SingleFile(options, 'KML', callback);
};

module.exports = KmlFormat;
