var ogr         = require('./ogr');

function csv() {}

csv.prototype = new ogr('csv');

var p = csv.prototype;

p._contentType = "text/csv; charset=utf-8; header=present";
p._fileExtension = "csv";

p.generate = function(options, callback) {
    var o = options;
    this.toOGR_SingleFile(o.database, o.user_id, o.gn, o.sql, o.skipfields, 'CSV', 'csv', o.filename, callback);
};

module.exports = csv;
