
function json() {
}

json.prototype = {

  id: "json",

  getQuery: function(sql, options) {
    return sql;
  },

  getContentType: function(){
    return "application/json; charset=utf-8";
  },

  getFileExtension: function() {
    return this.id;
  },

  transform: function(result, options, callback) {
    var j = {
      time: options.total_time,
      total_rows: result.rowCount,
      rows: result.rows
    }
    callback(null, j);
  }

};

module.exports = new json();
