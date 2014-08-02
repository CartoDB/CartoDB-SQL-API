var pg  = require('./pg'),
    _ = require('underscore'),
    geojson = require('./geojson'),
    TopoJSON = require('topojson');

function TopoJsonFormat() { }

TopoJsonFormat.prototype = new pg('topojson');

TopoJsonFormat.prototype.getQuery = function(sql, options) {
  return geojson.prototype.getQuery(sql, options) + ' where ' + options.gn + ' is not null';
};

TopoJsonFormat.prototype.transform = function(result, options, callback) {
  toTopoJSON(result, options.gn, options.skipfields, callback);
};

function toTopoJSON(data, gn, skipfields, callback){
  geojson.toGeoJSON(data, gn, function(err, geojson) {
    if ( err ) {
      callback(err, null);
      return;
    }
    var topology = TopoJSON.topology(geojson.features, {
    /* TODO: expose option to API for requesting an identifier
      "id": function(o) {
        console.log("id called with obj: "); console.dir(o);
        return o;
      },
    */
      "quantization": 1e4, // TODO: expose option to API (use existing "dp" for this ?)
      "force-clockwise": true,
      "property-filter": function(d) {
        // TODO: delegate skipfields handling to toGeoJSON
        return skipfields.indexOf(d) != -1 ? null : d;
      }
    });
    callback(err, topology);
  });
}


module.exports = TopoJsonFormat;
