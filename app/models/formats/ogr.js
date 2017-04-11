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
    return this.generateMD5([this.id,
        options.dbopts.dbname,
        options.dbopts.user,
        options.gn,
        options.filename,
        options.sql].concat(options.skipfields).join(':'));
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

  var that = this;

  var columns = [];
  var geocol;
  var pg;

  // Drop ending semicolon (ogr doens't like it)
  sql = sql.replace(/;\s*$/, '');

  step (

    function fetchColumns() {
      var colsql = 'SELECT * FROM (' + sql + ') as _cartodbsqlapi LIMIT 0';
      pg = new PSQL(dbopts, {}, { destroyOnError: true });
      pg.query(colsql, this);
    },
    // jshint maxcomplexity:9
    function findSRS(err, result) {
      assert.ifError(err);

      //if ( ! result.rows.length ) throw new Error("Query returns no rows");

      var needSRS = that._needSRS;

      // Skip system columns, find geom column
      for (var i=0; i<result.fields.length; ++i) {
        var field = result.fields[i];
        var k = field.name;
        if ( skipfields.indexOf(k) !== -1 ) {
            continue;
        }
        if ( out_format !== 'CSV' && k === "the_geom_webmercator" ) {
            continue;
        } // TODO: drop ?
        if ( out_format === 'CSV' ) {
            columns.push(pg.quoteIdentifier(k)+'::text');
        } else {
            columns.push(pg.quoteIdentifier(k));
        }

        if ( needSRS ) {
          if ( ! geocol && pg.typeName(field.dataTypeID) === 'geometry' ) {
            geocol = k;
          }
        }
      }
      //console.log(columns.join(','));

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

      var child = spawn(ogr2ogr, ogrargs);

/*
console.log('ogr2ogr ' + _.map(ogrargs, function(x) { return "'" + x + "'"; }).join(' '));
*/

      var stdout = '';
      child.stdout.on('data', function(data) {
        stdout += data;
        //console.log('stdout: ' + data);
      });

      var stderr;
      var logErrPat = new RegExp(/^ERROR/);
      child.stderr.on('data', function(data) {
        data = data.toString(); // know of a faster way ?
        // Store only the first ERROR line
        if ( ! stderr && data.match(logErrPat) ) {
            stderr = data;
        }
        console.log('ogr2ogr stderr: ' + data);
      });

      child.on('exit', function(code) {
        if ( code ) {
          console.log("ogr2ogr exited with code " + code);
          var emsg = stderr ? stderr.split('\n')[0] : ( "unknown ogr2ogr error (code " + code + ")" );
          // TODO: add more info about this error ?
          //if ( RegExp(/attempt to write non-.*geometry.*to.*type shapefile/i).exec(emsg) )
          next(new Error(emsg));
        } else {
          next(null);
        }
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
  var reqKey = this.generateMD5([
      fmt,
      dbname,
      user_id,
      gcol,
      layername,
      sql
  ].concat(skipfields).join(':'));
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
