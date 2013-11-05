var ogr         = require('./ogr');

function kml() {}

kml.prototype = new ogr('kml');

var p = kml.prototype;

p._contentType = "application/kml; charset=utf-8";
p._fileExtension = "kml";
// As of GDAL 1.10 SRID detection is bogus, so we use
// our own method. See:
//  http://trac.osgeo.org/gdal/ticket/5131
//  http://trac.osgeo.org/gdal/ticket/5287
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/110
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/116
p._needSRS = true;

p.generate = function(options, callback) {
    var o = options;
    this.toOGR_SingleFile(o.database, o.user_id, o.gn, o.sql, o.skipfields, 'KML', 'kml', callback);
};

module.exports = kml;
