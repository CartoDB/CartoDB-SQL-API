var _ = require('underscore'),
    pg  = require('./pg');

function GeoJsonFormat() {
    this.buffer = '';
}

GeoJsonFormat.prototype = new pg('geojson');

GeoJsonFormat.prototype._contentType = "application/json; charset=utf-8";

GeoJsonFormat.prototype.getQuery = function(sql, options) {
    var gn = options.gn;
    var dp = options.dp;
    return 'SELECT *, ST_AsGeoJSON(' + gn + ',' + dp + ') as the_geom FROM (' + sql + ') as foo';
};

GeoJsonFormat.prototype.startStreaming = function() {
    this.total_rows = 0;
    if (this.opts.beforeSink) {
        this.opts.beforeSink();
    }
    if (this.opts.callback) {
        this.buffer += this.opts.callback + '(';
    }
    this.buffer += '{"type": "FeatureCollection", "features": [';
    this._streamingStarted = true;
};

GeoJsonFormat.prototype.handleQueryRow = function(row) {

    if ( ! this._streamingStarted ) {
        this.startStreaming();
    }

    var geojson = [
        '{',
        '"type":"Feature",',
        '"geometry":' + row[this.opts.gn] + ',',
        '"properties":'
    ];
    delete row[this.opts.gn];
    delete row['the_geom_webmercator'];
    geojson.push(JSON.stringify(row));
    geojson.push('}');

    this.buffer += (this.total_rows++ ? ',' : '') + geojson.join('');

    if (this.total_rows % (this.opts.bufferedRows || 1000)) {
        this.opts.sink.write(this.buffer);
        this.buffer = '';
    }
};

GeoJsonFormat.prototype.handleQueryEnd = function(result) {
    if (this.error) {
        this.callback(this.error);
        return;
    }

    if ( ! this._streamingStarted ) {
        this.startStreaming();
    }

    this.buffer += ']}'; // end of features
    if (this.opts.callback) {
        this.buffer += ')';
    }

    this.opts.sink.write(this.buffer);
    this.opts.sink.end();
    this.buffer = '';

    this.callback();
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

module.exports = GeoJsonFormat;
module.exports.toGeoJSON = _toGeoJSON;
