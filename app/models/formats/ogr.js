'use strict';

var crypto = require('crypto');
var step = require('step');
var fs = require('fs');
var _ = require('underscore');
var PSQL = require('cartodb-psql');
var spawn = require('child_process').spawn;
var assert = require('assert');

// Keeps track of what's waiting baking for export
var bakingExports = {};

function OgrFormat(id) {
  this.id = id;
}

OgrFormat.prototype = {

  id: "ogr",

  is_file: true,

  getQuery: function(/*sql, options*/) {
    return null; // dont execute the query
  },

  transform: function(/*result, options, callback*/) {
    throw "should not be called for file formats";
  },

  getContentType: function(){ return this._contentType; },

  getFileExtension: function(){ return this._fileExtension; },

  getKey: function(options) {
    return [this.id,
        options.dbopts.dbname,
        options.dbopts.user,
        options.gn,
        this.generateMD5(options.filename),
        this.generateMD5(options.sql)].concat(options.skipfields).join(':');
  },

  generateMD5: function (data){
    var hash = crypto.createHash('md5');
    hash.update(data);
    return hash.digest('hex');
  }

};

// Internal function usable by all OGR-driven outputs
OgrFormat.prototype.toOGR = function(options, out_format, out_filename, callback) {

  //var gcol = options.gn;
  var sql = options.sql;
  var skipfields = options.skipfields;
  var out_layername = options.filename;

  var dbopts = options.dbopts;

  var ogr2ogr = global.settings.ogr2ogrCommand || 'ogr2ogr';
  var dbhost = dbopts.host;
  var dbport = dbopts.port;
  var dbuser = dbopts.user;
  var dbpass = dbopts.pass;
  var dbname = dbopts.dbname;

  var timeout = options.timeout;

  var that = this;

  var columns = [];
  var geocol;
  var pg;
  // Drop ending semicolon (ogr doens't like it)
  sql = sql.replace(/;\s*$/, '');

  const theGeomFirst = (fieldA, fieldB) => {
    if (fieldA.name === 'the_geom') {
      return -1;
    }
    if (fieldB.name === 'the_geom') {
      return 1;
    }
    return 0;
  };

  step (

    function fetchColumns() {
      var colsql = 'SELECT * FROM (' + sql + ') as _cartodbsqlapi LIMIT 0';
      pg = new PSQL(dbopts);
      pg.query(colsql, this);
    },
    function findSRS(err, result) {
      assert.ifError(err);

      var needSRS = that._needSRS;

      columns = result.fields
        // skip columns
        .filter(field => skipfields.indexOf(field.name) === -1)
        // put "the_geom" first (if exists)
        .sort(theGeomFirst)
        // get first geometry to calculate SRID ("the_geom" if exists)
        .map(field => {
          if (needSRS && !geocol && pg.typeName(field.dataTypeID) === 'geometry') {
            geocol = field.name;
          }

          return field;
        })
        // apply quotes to columns
        .map(field => out_format === 'CSV' ? pg.quoteIdentifier(field.name)+'::text' : pg.quoteIdentifier(field.name));

      if ( ! needSRS || ! geocol ) {
          return null;
      }

      var next = this;

      var qgeocol = pg.quoteIdentifier(geocol);
      var sridsql = 'SELECT ST_Srid(' + qgeocol + ') as srid, GeometryType(' +
                   qgeocol + ') as type FROM (' + sql + ') as _cartodbsqlapi WHERE ' +
                   qgeocol + ' is not null limit 1';

      pg.query(sridsql, function(err, result) {
        if ( err ) { next(err); return; }
        if ( result.rows.length ) {
          var srid = result.rows[0].srid;
          var type = result.rows[0].type;
          next(null, srid, type);
        } else {
          // continue as srid and geom type are not critical when there are no results
          next(null);
        }
      });
    },
    function spawnDumper(err, srid, type) {
      assert.ifError(err);

      var next = this;

      var ogrsql = 'SELECT ' + columns.join(',') + ' FROM (' + sql + ') as _cartodbsqlapi';

      var ogrargs = [
        '-f', out_format,
        '-lco', 'RESIZE=YES',
        '-lco', 'ENCODING=UTF-8',
        '-lco', 'LINEFORMAT=CRLF',
        out_filename,
        "PG:host=" + dbhost + " port=" + dbport + " user=" + dbuser + " dbname=" + dbname + " password=" + dbpass,
        '-sql', ogrsql
      ];

      if ( srid ) {
        ogrargs.push('-a_srs', 'EPSG:'+srid);
      }

      if ( type ) {
        ogrargs.push('-nlt', type);
      }

      if (options.cmd_params){
        ogrargs = ogrargs.concat(options.cmd_params);
      }

      ogrargs.push('-nln', out_layername);

      // TODO: research if `exec` could fit better than `spawn`
      var child = spawn(ogr2ogr, ogrargs);

      var timedOut = false;
      var ogrTimeout;
      if (timeout > 0) {
        ogrTimeout = setTimeout(function () {
          timedOut = true;
          child.kill();
        }, timeout);
      }

      child.on('error', function (err) {
        clearTimeout(ogrTimeout);
        next(err);
      });

      var stderrData = [];
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', function (data) {
        stderrData.push(data);
      });

      child.on('exit', function(code) {
        clearTimeout(ogrTimeout);

        if (timedOut) {
          return next(new Error('statement timeout'));
        }

        if (code !== 0) {
          var errMessage = 'ogr2ogr command return code ' + code;
          if (stderrData.length > 0) {
            errMessage += ', Error: ' + stderrData.join('\n');
          }

          return next(new Error(errMessage));
        }

        return next();
      });

    },
    function finish(err) {
      callback(err, out_filename);
    }
  );
};

OgrFormat.prototype.toOGR_SingleFile = function(options, fmt, callback) {

  var dbname = options.dbopts.dbname;
  var user_id = options.dbopts.user;
  var gcol = options.gcol;
  var sql = options.sql;
  var skipfields = options.skipfields;
  var ext = this._fileExtension;
  var layername = options.filename;

  var tmpdir = global.settings.tmpDir || '/tmp';
  var reqKey = [
      fmt,
      dbname,
      user_id,
      gcol,
      this.generateMD5(layername),
      this.generateMD5(sql)
  ].concat(skipfields).join(':');
  var outdirpath = tmpdir + '/sqlapi-' + process.pid + '-' + reqKey;
  var dumpfile = outdirpath + ':cartodb-query.' + ext;

  // TODO: following tests:
  //  - fetch query with no "the_geom" column
  this.toOGR(options, fmt, dumpfile, callback);
};

OgrFormat.prototype.sendResponse = function(opts, callback) {
  //var next = callback;
  var reqKey = this.getKey(opts);
  var qElem = new ExportRequest(opts.sink, callback, opts.beforeSink);
  var baking = bakingExports[reqKey];
  if ( baking ) {
    baking.req.push( qElem );
  } else {
    baking = bakingExports[reqKey] = { req: [ qElem ] };
    this.generate(opts, function(err, dumpfile) {
      if ( opts.profiler ) {
          opts.profiler.done('generate');
      }
      step (
        function sendResults() {
          var nextPipe = function(finish) {
            var r = baking.req.shift();
            if ( ! r ) { finish(null); return; }
            r.sendFile(err, dumpfile, function() {
              nextPipe(finish);
            });
          };

          if ( ! err ) {
              nextPipe(this);
          } else {
            _.each(baking.req, function(r) {
              r.cb(err);
            });
            return true;
          }
        },
        function cleanup(/*err*/) {
          delete bakingExports[reqKey];

          // unlink dump file (sync to avoid race condition)
          console.log("removing", dumpfile);
          try { fs.unlinkSync(dumpfile); }
          catch (e) {
            if ( e.code !== 'ENOENT' ) {
              console.log("Could not unlink dumpfile " + dumpfile + ": " + e);
            }
          }
        }
      );
    });
  }
};

// TODO: put in an ExportRequest.js ----- {

function ExportRequest(ostream, callback, beforeSink) {
  this.cb = callback;
  this.beforeSink = beforeSink;
  this.ostream = ostream;
  this.istream = null;
  this.canceled = false;

  var that = this;

  this.ostream.on('close', function() {
    //console.log("Request close event, qElem.stream is " + qElem.stream);
    that.canceled = true;
    if ( that.istream ) {
      that.istream.destroy();
    }
  });
}

ExportRequest.prototype.sendFile = function (err, filename, callback) {
  var that = this;
  if ( ! this.canceled ) {
    //console.log("Creating readable stream out of dumpfile");
    this.istream = fs.createReadStream(filename)
    .on('open', function(/*fd*/) {
      if ( that.beforeSink ) {
          that.beforeSink();
      }
      that.istream.pipe(that.ostream);
      callback();
    })
    .on('error', function(e) {
      console.log("Can't send response: " + e);
      that.ostream.end();
      callback();
    });
  } else {
    //console.log("Response was canceled, not streaming the file");
    callback();
  }
  this.cb();
};

//------ }

module.exports = OgrFormat;
