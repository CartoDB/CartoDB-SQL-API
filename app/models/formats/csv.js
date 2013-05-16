

var shp = require('./shp');
var toOGR = shp.toOGR;
var generateMD5 = shp.generateMD5;

function csv() {
}

csv.prototype = {

  id: "csv",

  is_file: true,

  getQuery: function(sql, options) {
    return null; // dont execute the query
  },

  getContentType: function(){
    return "text/csv; charset=utf-8; header=present";
  },

  getFileExtension: function() {
    return "csv"
  },

  transform: function(result, options, callback) {
    throw "should not be called for file formats"
  },

  getKey: function(options) {
    return [this.id,
        options.dbname,
        options.user_id,
        options.gn,
        generateMD5(options.sql)].concat(options.skipfields).join(':');
  },

  generate: function(options, callback) {
    var o = options;
    toOGR_SingleFile(o.database, o.user_id, o.gn, o.sql, o.skipfields, 'CSV', 'csv', callback);
  }

};

function toOGR_SingleFile(dbname, user_id, gcol, sql, skipfields, fmt, ext, callback) {
  var tmpdir = global.settings.tmpDir || '/tmp';
  var reqKey = [ fmt, dbname, user_id, gcol, generateMD5(sql) ].concat(skipfields).join(':');
  var outdirpath = tmpdir + '/sqlapi-' + reqKey;
  var dumpfile = outdirpath + ':cartodb-query.' + ext;

  // TODO: following tests:
  //  - fetch query with no "the_geom" column
  toOGR(dbname, user_id, gcol, sql, skipfields, fmt, dumpfile, callback);
}

module.exports = new csv();
module.exports.toOGR_SingleFile = toOGR_SingleFile;
