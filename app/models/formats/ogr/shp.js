var step = require('step');
var fs = require('fs');
var spawn = require('child_process').spawn;
var assert = require('assert');

var ogr = require('./../ogr');

function ShpFormat() {
}

ShpFormat.prototype = new ogr('shp');

ShpFormat.prototype._contentType = "application/zip; charset=utf-8";
ShpFormat.prototype._fileExtension = "zip";
// As of GDAL 1.10 SRID detection is bogus, so we use
// our own method. See:
//  http://trac.osgeo.org/gdal/ticket/5131
//  http://trac.osgeo.org/gdal/ticket/5287
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/110
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/116
ShpFormat.prototype._needSRS = true;

ShpFormat.prototype.generate = function(options, callback) {
  this.toSHP(options, callback);
};

ShpFormat.prototype.toSHP = function (options, callback) {
  var dbname = options.database;
  var user_id = options.user_id;
  var gcol = options.gn;
  var sql = options.sql;
  var skipfields = options.skipfields;
  var filename = options.filename;

  var fmtObj = this;
  var zip = 'zip'; // FIXME: make configurable
  var tmpdir = global.settings.tmpDir || '/tmp';
  var reqKey = this.generateMD5([ 'shp', dbname, user_id, gcol, sql ].concat(skipfields).join(':'));
  var outdirpath = tmpdir + '/sqlapi-' + process.pid + '-' + reqKey; 
  var zipfile = outdirpath + '.zip';
  var shapefile = outdirpath + '/' + filename + '.shp';

  // TODO: following tests:
  //  - fetch query with no "the_geom" column

  step (
    function createOutDir() {
      fs.mkdir(outdirpath, 0777, this);
    },
    function spawnDumper(err) {
      assert.ifError(err);

      fmtObj.toOGR(options, 'ESRI Shapefile', shapefile, this);
    },
    function doZip(err) {
      assert.ifError(err);

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
          } else {
              unlinkall(dir, files, finish);
          }
        });
      };
      fs.readdir(outdirpath, function(err, files) {
        if ( err ) {
          if ( err.code !== 'ENOENT' ) {
            next(new Error([topError, err].join('\n')));
          } else {
            next(topError);
          }
        } else {
          unlinkall(outdirpath, files, function(/*err*/) {
            fs.rmdir(outdirpath, function(err) {
              if ( err ) {
                  console.log("Removing dir " + outdirpath + ": " + err);
              }
              next(topError, zipfile);
            });
          });
        }
      });
    },
    function finalStep(err, zipfile) {
      callback(err, zipfile);
    }
  );
};


module.exports = ShpFormat;

