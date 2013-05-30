var pg  = require('./pg');
var ArrayBufferSer = require("../bin_encoder");
var _ = require('underscore');

function binary() {}

binary.prototype = new pg('arraybuffer');

binary.prototype._contentType = "application/octet-stream";

binary.prototype._extractTypeFromName = function(name) {
  var g = name.match(new RegExp(/.*__(uintclamp|uint|int|float)(8|16|32)/i))
  if(g && g.length == 3) {
    var typeName = g[1] + g[2];
    return ArrayBufferSer.typeNames[typeName];
  }
};

binary.prototype.transform = function(result, options, callback) {
  var total_rows = result.rowCount;
  var rows = result.rows

  // get headers 
  if(!total_rows) {
    callback(null, new Buffer(0));
    return;
  }

  var headersNames = Object.keys(rows[0]);
  var headerTypes = [];

  if(_.contains(headersNames, 'the_geom')) {
    callback(new Error("geometry types are not supported"), null);
    return;
  }

  try {

    // get header types (and guess from name)
    for(var i = 0; i < headersNames.length; ++i) {
      var r = rows[0];
      var n = headersNames[i];
      if(typeof(r[n]) == 'string') {
        headerTypes.push(ArrayBufferSer.STRING);
      } else if(typeof(r[n]) == 'object') {
        var t = this._extractTypeFromName(n);
        t = t == undefined ? ArrayBufferSer.FLOAT32: t;
        headerTypes.push(ArrayBufferSer.BUFFER + t);
      } else {
        var t = this._extractTypeFromName(n);
        headerTypes.push(t == undefined ? ArrayBufferSer.FLOAT32: t);
      }
    }

    // pack the data
    var header = new ArrayBufferSer(ArrayBufferSer.STRING, headersNames);
    var data = [header];
    for(var i = 0; i < headersNames.length; ++i) {
      var d = [];
      var n = headersNames[i];
      for(var r = 0; r < total_rows; ++r) {
        var row = rows[r][n]; 
        if(headerTypes[i] > ArrayBufferSer.BUFFER) {
          row = new ArrayBufferSer(headerTypes[i] - ArrayBufferSer.BUFFER, row);
        }
        d.push(row);
      };
      var b = new ArrayBufferSer(headerTypes[i], d);
      data.push(b);
    }

    // create the final buffer
    var all = new ArrayBufferSer(ArrayBufferSer.BUFFER, data);

    callback(null, all.buffer);

  } catch(e) {
    callback(e, null);
  }
};

module.exports = binary;
