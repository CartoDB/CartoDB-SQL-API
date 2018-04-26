// This is a multer "custom storage engine", see
// https://github.com/expressjs/multer/blob/master/StorageEngine.md
// for the contract. 

var _ = require('underscore');
var fs = require('fs');
var copyFrom = require('pg-copy-streams').from;
var PSQL = require('cartodb-psql');

function PgCopyCustomStorage (opts) {
    this.opts = opts || {};
}

// Pick the URL or the body SQL query, prefering the body query
// if both are filled in (???)
function getSqlParam(req) {
    var b_sql = req.body.sql;
    b_sql = (b_sql === "" || _.isUndefined(b_sql)) ? null : b_sql;
    var q_sql = req.query.sql;
    q_sql = (q_sql === "" || _.isUndefined(q_sql)) ? null : q_sql;
    return b_sql || q_sql;
}

PgCopyCustomStorage.prototype._handleFile = function _handleFile (req, file, cb) {

    // Hopefully the body-parser has extracted the 'sql' parameter
    // or the user has provided it on the URL line.
    // Otherwise, this will be a short trip, as we won't be able
    // to the pg-copy-streams SQL command
    var sql = getSqlParam(req);
  
    // Ensure SQL parameter is not missing
    if (!_.isString(sql)) {
        cb(new Error("Parameter 'sql' is missing, must be in URL or first field in POST"));
    }
    
    // Only accept SQL that starts with 'COPY'
    if (!sql.toUpperCase().startsWith("COPY ")) {
        cb(new Error("SQL must start with COPY"));
    }    

    // We expect the an earlier middleware to have 
    // set this by the time we are called via multer,
    // so this should never happen
    if (!req.userDbParams) {
        cb(new Error("req.userDbParams is not set"));
    }

    var copyFromStream = copyFrom(sql);

    try {
        // Connect and run the COPY
        var pg = new PSQL(req.userDbParams);
        var start_time = Date.now();
        
        pg.connect(function(err, client, done) {
            if (err) {
                return done(err);
            }
            var pgstream = client.query(copyFromStream);
            file.stream.on('error', cb);
            pgstream.on('error', cb);
            pgstream.on('end', function () {
                var end_time = Date.now();
                cb(null, {
                    total_rows: copyFromStream.rowCount,
                    time: (end_time - start_time)/1000
                });
            });
            file.stream.pipe(pgstream);
        });

    } catch (err) {
        cb(err);
    }
    return;

};

PgCopyCustomStorage.prototype._removeFile = function _removeFile (req, file, cb) {
    fs.unlink(file.path, cb);
};

module.exports = function (opts) {
    return new PgCopyCustomStorage(opts);
};
