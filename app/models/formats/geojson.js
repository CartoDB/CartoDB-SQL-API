
var _ = require('underscore')
var pg  = require('./pg');

function geojson() {}

geojson.prototype = new pg('geojson');

var p = geojson.prototype;

p._contentType = "application/json; charset=utf-8";

p.getQuery = function(sql, options) {
    var gn = options.gn;
    var dp = options.dp;
    return 'SELECT *, ST_AsGeoJSON(' + gn + ',' + dp + ') as the_geom FROM (' + sql + ') as foo';
};

p.transform = function(result, options, callback) {
  _toGeoJSON(result, options.gn, callback);
};

function _toGeoJSON(data, gn, callback){
  try {
    var out = {
      type: "FeatureCollection",
      features: []
    };

    _.each(data.rows, function(ele){
      var _geojson = {
          type: "Feature",
          properties: { },
          geometry: { }
      };
      _geojson.geometry = JSON.parse(ele[gn]);
      delete ele[gn];
      delete ele["the_geom_webmercator"]; // TODO: use skipfields
      _geojson.properties = ele;
      out.features.push(_geojson);
    });

    // return payload
    callback(null, out);
  } catch (err) {
    callback(err,null);
  }
}

module.exports = geojson;
module.exports.toGeoJSON = _toGeoJSON
