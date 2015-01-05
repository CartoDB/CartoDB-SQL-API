"use strict";

var fs = require("fs"),
    util = require("util"),
    zlib = require("zlib");

var async = require("async"),
    mapnik = require("mapnik"),
    PSQL = require("cartodb-psql"),
    mercator = new (require("sphericalmercator"))();

// TODO check that the relative path works (otherwise use __dirname)
var XML_TEMPLATE = fs.readFileSync("../../../config/pbf_template.xml");

// TODO mapnik-pool

var PBF = function() {};

PBF.prototype.getContentType = function() {
  return "application/x-protobuf";
};

PBF.prototype.getFileExtension = function() {
  return "pbf";
};

PBF.prototype.sendResponse = function(options, callback) {
  var pg = new PSQL(options.dbopts),
      z = options.params.z | 0,
      x = options.params.x | 0,
      y = options.params.y | 0;

  console.log("SQL:", options.sql);

  return async.waterfall([
    function(done) {
      // TODO might we have !bbox!-style tokens?
      // alternately, CDB_...XY will be part of the query and z,x,y will be
      // duplicated in the params
      var query = util.format("SELECT * FROM (%s) AS _ LIMIT 0", options.sql);
      return pg.query(query, done);
    },
    function(result, done) {
      var cols = result.fields
        .filter(function(x) {
          return options.skipfields.indexOf(x.name) >= 0;
        })
        .map(function(x) {
          return pg.quoteIdentifier(x.name);
        });

      var query = util.format("SELECT %s FROM (%s) AS _",
                              cols.join(", "),
                              options.sql);

      return done(null, query);
    },
    function(query, done) {
      // TODO use mapnik=pool
      var map = new mapnik.Map(256, 256);

      map.extent = mercator.bbox(x, y, z, false, "900913");

      // TODO use handlebars instead
      var xml = XML_TEMPLATE
        .replace(/{{name}}/, options.filename)
        .replace(/{{dbname}}/, options.dbopts.dbname)
        .replace(/{{host}}/, options.dbopts.host)
        .replace(/{{user}}/, options.dbopts.user)
        .replace(/{{password}}/, options.dbopts.pass)
        .replace(/{{port}}/, options.dbopts.port)
        .replace(/{{geometry_field}}/, options.gn);

      return map.fromString(xml, {
        strict: true
      }, done);
    },
    function(map, done) {
      map.bufferSize = 256; // TODO make configurable (and prefer tile-specific opts)

      var opts = {
        buffer_size: map.bufferSize, // TODO make optional
        tolerance: Math.max(0, Math.min(5, 14 - z))
      };

      return map.render(new mapnik.VectorTile(z, x, y), opts, done);
    },
    function(vtile, done) {
      return zlib.gzip(vtile.getData(), done);
    }
  ], function(err, buffer) {
    if (err) {
      return callback(err);
    }

    // set the content encoding (we know sink is an HttpResponse)
    options.sink.set("Content-Encoding", "gzip");

    options.sink.send(buffer);

    return callback();
  });
};

module.exports = PBF;
