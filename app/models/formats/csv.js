var ogr         = require('./ogr');

function csv() {}

csv.prototype = new ogr('csv');

var p = csv.prototype;

p._contentType = "text/csv; charset=utf-8; header=present";
p._fileExtension = "csv";

p.generate = function(options, callback) {
    this.toOGR_SingleFile(options, 'CSV', callback);
};

module.exports = csv;
