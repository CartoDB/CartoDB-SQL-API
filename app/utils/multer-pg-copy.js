// This is a multer "custom storage engine", see
// https://github.com/expressjs/multer/blob/master/StorageEngine.md
// for the contract. 

var _ = require('underscore');
var fs = require('fs');
var copyFrom = require('pg-copy-streams').from;

function PgCopyCustomStorage (opts) {
  this.opts = opts || {};
}

PgCopyCustomStorage.prototype._handleFile = function _handleFile (req, file, cb) {

  // Skip the pg-copy for now, just write to /tmp/
  // so we can see what parameters are making it into 
  // this storage handler
  var debug_customstorage = true; 

  // Hopefully the body-parser has extracted the 'sql' parameter
  // Otherwise, this will be a short trip, as we won't be able
  // to run the pg-copy-streams
  var sql = req.body.sql;
  sql = (sql === "" || _.isUndefined(sql)) ? null : sql;

  console.debug("PgCopyCustomStorage.prototype._handleFile");
  console.debug("PgCopyCustomStorage.prototype._handleFile: sql = '%s'", sql);
  
  if (debug_customstorage) {
    var outStream = fs.createWriteStream('/tmp/sqlApiUploadExample');
    file.stream.pipe(outStream);
    outStream.on('error', cb);
    outStream.on('finish', function () {
      cb(null, {
        path: file.path,
        size: outStream.bytesWritten
      });
    });
    
  } else {
    // TODO, handle this nicely
    if(!_.isString(sql)) {
      throw new Error("sql is not set");
    }

    // We expect the pg-connect middleware to have 
    // set this by the time we are called via multer
    if (!req.authDbConnection) {
      throw new Error("req.authDbConnection is not set");
    }
    var sessionPg = req.authDbConnection;

    sessionPg.connect(function(err, client, done) {
      if (err) {
        return cb(err);
      }

      console.debug("XXX pg.connect");

      // This is the magic part, see 
      // https://github.com/brianc/node-pg-copy-streams
      var outStream = client.query(copyFrom(sql), function(err, result) {
        done(err);
        return cb(err, result);
      });

      file.stream.on('error', cb);
      outStream.on('error', cb);
      outStream.on('end', cb);
      file.stream.pipe(outStream);
    });
  }
};

PgCopyCustomStorage.prototype._removeFile = function _removeFile (req, file, cb) {
    fs.unlink(file.path, cb);
};

module.exports = function (opts) {
    return new PgCopyCustomStorage(opts);
};
