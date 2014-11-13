var pg  = require('./pg'),
    _ = require('underscore'),
    geojson = require('./geojson'),
    TopoJSON = require('topojson');

function TopoJsonFormat() {
    this.features = [];
}

TopoJsonFormat.prototype = new pg('topojson');

TopoJsonFormat.prototype.getQuery = function(sql, options) {
  return geojson.prototype.getQuery(sql, options) + ' where ' + options.gn + ' is not null';
};

TopoJsonFormat.prototype.handleQueryRow = function(row) {
    var _geojson = {
        type: "Feature"
    };
    _geojson.geometry = JSON.parse(row[this.opts.gn]);
    delete row[this.opts.gn];
    delete row["the_geom_webmercator"];
    _geojson.properties = row;
    this.features.push(_geojson);
};

TopoJsonFormat.prototype.handleQueryEnd = function() {
    if (this.error) {
        this.callback(this.error);
        return;
    }

    if ( this.opts.profiler ) this.opts.profiler.done('gotRows');

    var topology = TopoJSON.topology(this.features, {
        "quantization": 1e4,
        "force-clockwise": true,
        "property-filter": function(d) {
            return d;
        }
    });

    this.features = [];

    var stream = this.opts.sink;
    var jsonpCallback = this.opts.callback;
    var bufferedRows = this.opts.bufferedRows;
    var buffer = '';

    var immediately = global.setImmediate || process.nextTick;

    function streamObjectSubtree(obj, key, done) {
        buffer += '"' + key + '":';

        var isObject = _.isObject(obj[key]),
            isArray = _.isArray(obj[key]),
            isIterable = isArray || isObject;

        if (isIterable) {
            buffer += isArray ? '[' : '{';
            var subtreeKeys = Object.keys(obj[key]);
            var pos = 0;
            function streamNext() {
                immediately(function() {
                    var subtreeKey = subtreeKeys.shift();
                    if (!isArray) {
                        buffer += '"' + subtreeKey + '":';
                    }
                    buffer += JSON.stringify(obj[key][subtreeKey]);

                    if (pos++ % (bufferedRows || 1000)) {
                        stream.write(buffer);
                        buffer = '';
                    }

                    if (subtreeKeys.length > 0) {
                        delete obj[key][subtreeKey];
                        buffer += ',';
                        streamNext();
                    } else {
                        buffer += isArray ? ']' : '}';
                        stream.write(buffer);
                        buffer = '';
                        done();
                    }
                });
            }
            streamNext();
        } else {
            buffer += JSON.stringify(obj[key]);
            done();
        }
    }

    if (jsonpCallback) {
        buffer += jsonpCallback + '(';
    }
    buffer += '{';
    var keys = Object.keys(topology);
    function sendResponse() {
        immediately(function () {
            var key = keys.shift();
            function done() {
                if (keys.length > 0) {
                    delete topology[key];
                    buffer += ',';
                    sendResponse();
                } else {
                    buffer += '}';
                    if (jsonpCallback) {
                        buffer += ')';
                    }
                    stream.write(buffer);
                    stream.end();
                    topology = null;
                }
            }
            streamObjectSubtree(topology, key, done);
        });
    }
    sendResponse();

    this.callback();
};

TopoJsonFormat.prototype.cancel = function() {
    if (this.queryCanceller) {
        this.queryCanceller.call();
    }
};



module.exports = TopoJsonFormat;
