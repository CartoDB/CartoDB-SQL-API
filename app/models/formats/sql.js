var ogr         = require('./ogr');

function sql() {}

sql.prototype = new ogr('sql');

var p = sql.prototype;

p._contentType = "application/sql; charset=utf-8";
p._fileExtension = "sql";

p.generate = function(options, callback) {
    var o = options;
    this.toOGR_SingleFile(o.database, o.user_id, o.gn, o.sql, o.skipfields, 'PGDump', 'sql', callback);
};

module.exports = sql;
