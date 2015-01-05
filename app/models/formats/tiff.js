"use strict";

var util = require("util");

var pg = require("./pg");

var TIFF = function() {};

TIFF.prototype = new pg("tiff");

TIFF.prototype._contentType = "image/tiff";

TIFF.prototype.getQuery = function(sql, options) {
  // the query will contain conversion from coords to a bbox
  // NOTE: gn is assumed to be the raster column rather than the geometry
  // column
  return util.format("SELECT ST_AsTiff(%d, '') tiff FROM (%s) AS _ LIMIT 1", options.gn, sql);
};

TIFF.prototype.transform = function(result, options, callback) {
  if (result.rows.length > 0) {
    return callback(null, result.rows[0].tiff);
  }

  // TODO this should 404 instead
  return callback(null, new Buffer(0));
};

module.exports = TIFF;
