var pg  = require('./pg'),
    ArrayBufferSer = require("../bin_encoder"),
    _ = require('underscore');

function BinaryFormat() {}

BinaryFormat.prototype = new pg('raw');

BinaryFormat.prototype._contentType = "application/octet-stream";

BinaryFormat.prototype.transform = function(result, options, callback) {
  var total_rows = result.rowCount;
  var rows = result.rows;
  console.log(result);

  // get headers 
  if (!total_rows) {
    callback(null, new Buffer(0));
    return;
  }

  var headerNames = Object.keys(rows[0]);

  if (headerNames.length !== 1 || result.fields[0].dataTypeID !== 17 /* bytea */) {
    callback(new Error("only a single bytea column supported"));
    return;
  };

  // calculate the size
  var name = headerNames[0],
      size = 0,
      v, r;
  for(r = 0; r < total_rows; ++r) {
    v = rows[r][name]; 
    size += v.length;
  }

  var buf = new Buffer(size);
  var index = 0;
  for(r = 0; r < total_rows; ++r) {
    v = rows[r][name];
    v.copy(buf, index);
    index += v.length;
  }

  callback(null, buf);

};

module.exports = BinaryFormat;
