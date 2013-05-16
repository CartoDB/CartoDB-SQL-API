var toOGR_SingleFile = require('./csv').toOGR_SingleFile
var generateMD5 = require('./shp').generateMD5;

function kml() {
}

kml.prototype = {

  id: "kml",

  is_file: true,

  getQuery: function(sql, options) {
    return null; // dont execute the query
  },

  getContentType: function(){
    return "application/kml; charset=utf-8";
  },

  getFileExtension: function() {
    return "kml"
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
    toOGR_SingleFile(o.database, o.user_id, o.gn, o.sql, o.skipfields, 'KML', 'kml', callback);
  }

};

module.exports = new kml();
