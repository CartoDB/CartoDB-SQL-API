
var crypto      = require('crypto')
var Step        = require('step')
var fs          = require('fs')
var _           = require('underscore')
var PSQL        = require(global.settings.app_root + '/app/models/psql')
var spawn       = require('child_process').spawn

function shp() {
}

shp.prototype = {

  id: "shp",

  is_file: true,

  getQuery: function(sql, options) {
    return null; // dont execute the query
  },

  getContentType: function(){
    return "application/zip; charset=utf-8";
  },

  getFileExtension: function() {
    return "zip"
  },

  transform: function(result, options, callback) {
    throw "should not be called for file formats"
  },

  getKey: function(options) {
    return [this.id,
        options.dbname,
        options.user_id,
        options.gn,
        generateMD5(options.sql)].concat(options.skipfields).join(':');
  },

  generate: function(options, callback) {
    var o = options;
    toSHP(o.database, o.user_id, o.gn, o.sql, o.skipfields, o.filename, callback);
  }

};

function generateMD5(data){
    var hash = crypto.createHash('md5');
    hash.update(data);
    return hash.digest('hex');
}



// Return database username from user_id
// NOTE: a "null" user_id is a request to use the public user
function userid_to_dbuser(user_id) {
  if ( _.isString(user_id) )
      return _.template(global.settings.db_user, {user_id: user_id});
  return "publicuser" // FIXME: make configurable
};



// Internal function usable by all OGR-driven outputs
function toOGR(dbname, user_id, gcol, sql, skipfields, out_format, out_filename, callback) {
  var ogr2ogr = 'ogr2ogr'; // FIXME: make configurable
  var dbhost = global.settings.db_host;
  var dbport = global.settings.db_port;
  var dbuser = userid_to_dbuser(user_id);
  var dbpass = ''; // turn into a parameter..

  var columns = [];

  // Drop ending semicolon (ogr doens't like it)
  sql = sql.replace(/;\s*$/, ''); 

  Step (

    function fetchColumns() {
      var colsql = 'SELECT * FROM (' + sql + ') as _cartodbsqlapi LIMIT 1';
      var pg = new PSQL(user_id, dbname, 1, 0);
      pg.query(colsql, this);
    },
    function spawnDumper(err, result) {
      if (err) throw err;

      //if ( ! result.rows.length ) throw new Error("Query returns no rows");

      // Skip system columns
      if ( result.rows.length ) {
        for (var k in result.rows[0]) {
          if ( skipfields.indexOf(k) != -1 ) continue;
          if ( out_format != 'CSV' && k == "the_geom_webmercator" ) continue; // TODO: drop ?
          if ( out_format == 'CSV' ) columns.push('"' + k + '"::text');
          else columns.push('"' + k + '"');
        }
      } else columns.push('*');
      //console.log(columns.join(','));

      var next = this;

      sql = 'SELECT ' + columns.join(',')
          + ' FROM (' + sql + ') as _cartodbsqlapi';

      var child = spawn(ogr2ogr, [
        '-f', out_format,
        '-lco', 'ENCODING=UTF-8',
        '-lco', 'LINEFORMAT=CRLF',
        out_filename,
        "PG:host=" + dbhost
         + " user=" + dbuser
         + " dbname=" + dbname
         + " password=" + dbpass
         + " tables=fake" // trick to skip query to geometry_columns
         + "",
        '-sql', sql
      ]);

/*
console.log(['ogr2ogr',
        '-f', '"'+out_format+'"',
        out_filename,
        "'PG:host=" + dbhost
         + " user=" + dbuser
         + " dbname=" + dbname
         + " password=" + dbpass
         + " tables=fake" // trick to skip query to geometry_columns
         + "'",
        "-sql '", sql, "'"].join(' '));
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
        if ( ! stderr && data.match(logErrPat) ) stderr = data;
        console.log('ogr2ogr stderr: ' + data);
      });

      child.on('exit', function(code) {
        if ( code ) {
          var emsg = stderr.split('\n')[0];
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
}

function toSHP(dbname, user_id, gcol, sql, skipfields, filename, callback) {
  var zip = 'zip'; // FIXME: make configurable
  var tmpdir = global.settings.tmpDir || '/tmp';
  var reqKey = [ 'shp', dbname, user_id, gcol, generateMD5(sql) ].concat(skipfields).join(':');
  var outdirpath = tmpdir + '/sqlapi-' + reqKey; 
  var zipfile = outdirpath + '.zip';
  var shapefile = outdirpath + '/' + filename + '.shp';

  // TODO: following tests:
  //  - fetch query with no "the_geom" column

  Step (
    function createOutDir() {
      fs.mkdir(outdirpath, 0777, this);
    },
    function spawnDumper(err) {
      if ( err ) throw err;
      toOGR(dbname, user_id, gcol, sql, skipfields, 'ESRI Shapefile', shapefile, this);
    },
    function doZip(err) {
      if ( err ) throw err;

      var next = this;

      var child = spawn(zip, ['-qrj', zipfile, outdirpath ]);

      child.on('exit', function(code) {
        //console.log("Zip complete, zip return code was " + code);
        if (code) {
          next(new Error("Zip command return code " + code));
          //res.statusCode = 500; 
        }
        next(null);
      });

    },
    function cleanupDir(topError) {

      var next = this;

      //console.log("Cleaning up " + outdirpath);

      // Unlink the dir content
      var unlinkall = function(dir, files, finish) {
        var f = files.shift();
        if ( ! f ) { finish(null); return; }
        var fn = dir + '/' + f;
        fs.unlink(fn, function(err) {
          if ( err ) {
            console.log("Unlinking " + fn + ": " + err);
            finish(err);
          }
          else unlinkall(dir, files, finish)
        });
      }
      fs.readdir(outdirpath, function(err, files) {
        if ( err ) {
          if ( err.code != 'ENOENT' ) {
            next(new Error([topError, err].join('\n')));
          } else {
            next(topError);
          }
        } else {
          unlinkall(outdirpath, files, function(err) {
            fs.rmdir(outdirpath, function(err) {
              if ( err ) console.log("Removing dir " + path + ": " + err);
              callback(topError, zipfile);
            });
          });
        }
      });
    }
  );
}


module.exports = new shp();
module.exports.toOGR = toOGR;
module.exports.generateMD5 = generateMD5

