var pg  = require('./pg');

function json() {}

json.prototype = new pg('json');

var p = json.prototype;

p._contentType = "application/json; charset=utf-8";

p.transform = function(result, options, callback) {
  var j = {
    time: options.total_time,
    total_rows: result.rowCount,
    rows: result.rows
  }
  callback(null, j);
};

module.exports = json;
