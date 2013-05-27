var ogr         = require('./ogr');

function kml() {}

kml.prototype = new ogr('kml');

var p = kml.prototype;

p._contentType = "application/kml; charset=utf-8";
p._fileExtension = "kml";

p.generate = function(options, callback) {
    var o = options;
    this.toOGR_SingleFile(o.database, o.user_id, o.gn, o.sql, o.skipfields, 'KML', 'kml', callback);
};

module.exports = kml;
