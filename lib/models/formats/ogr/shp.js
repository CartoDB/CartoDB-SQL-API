'use strict';

var uuid = require('uuid');
var step = require('step');
var fs = require('fs');
var spawn = require('child_process').spawn;

var Ogr = require('./../ogr');

function ShpFormat () {
}

ShpFormat.prototype = new Ogr('shp');

ShpFormat.prototype._contentType = 'application/zip; charset=utf-8';
ShpFormat.prototype._fileExtension = 'zip';
// As of GDAL 1.10 SRID detection is bogus, so we use
// our own method. See:
//  http://trac.osgeo.org/gdal/ticket/5131
//  http://trac.osgeo.org/gdal/ticket/5287
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/110
//  http://github.com/CartoDB/CartoDB-SQL-API/issues/116
ShpFormat.prototype._needSRS = true;

ShpFormat.prototype.generate = function (options, callback) {
    this.toSHP(options, callback);
};

ShpFormat.prototype.toSHP = function (options, callback) {
    var dbname = options.database;
    var userId = options.user_id;
    var gcol = options.gn;
    var sql = options.sql;
    var skipfields = options.skipfields;
    var filename = options.filename;

    var fmtObj = this;
    var zip = global.settings.zipCommand || 'zip';
    var zipOptions = '-qrj';
    var tmpdir = global.settings.tmpDir || '/tmp';
    var reqKey = this.limitPathname(['shp', dbname, userId, gcol, this.generateMD5(sql), uuid.v4()].concat(skipfields).join(':'));
    var outdirpath = tmpdir + '/sqlapi-' + process.pid + '-' + reqKey;
    var zipfile = outdirpath + '.zip';
    var shapefile = outdirpath + '/' + filename + '.shp';

    // TODO: following tests:
    //  - fetch query with no "the_geom" column

    step(
        function createOutDir () {
            fs.mkdir(outdirpath, 0o777, this);
        },
        function spawnDumper (err) {
            if (err) {
                throw err;
            }

            fmtObj.toOGR(options, 'ESRI Shapefile', shapefile, this);
        },
        function doZip (err) {
            if (err) {
                throw err;
            }

            var next = this;

            var child = spawn(zip, [zipOptions, zipfile, outdirpath]);

            child.on('error', function (err) {
                next(new Error('Error executing zip command,  ' + err));
            });

            var stderrData = [];
            child.stderr.setEncoding('utf8');
            child.stderr.on('data', function (data) {
                stderrData.push(data);
            });

            child.on('exit', function (code) {
                if (code !== 0) {
                    var errMessage = 'Zip command return code ' + code;
                    if (stderrData.length) {
                        errMessage += ', Error: ' + stderrData.join('\n');
                    }

                    return next(new Error(errMessage));
                }

                return next();
            });
        },
        function cleanupDir (topError) {
            var next = this;

            // Unlink the dir content
            var unlinkall = function (dir, files, finish) {
                var f = files.shift();
                if (!f) { finish(null); return; }
                var fn = dir + '/' + f;
                fs.unlink(fn, function (err) {
                    if (err) {
                        console.log('Unlinking ' + fn + ': ' + err);
                        finish(err);
                    } else {
                        unlinkall(dir, files, finish);
                    }
                });
            };
            fs.readdir(outdirpath, function (err, files) {
                if (err) {
                    if (err.code !== 'ENOENT') {
                        next(new Error([topError, err].join('\n')));
                    } else {
                        next(topError);
                    }
                } else {
                    unlinkall(outdirpath, files, function (/* err */) {
                        fs.rmdir(outdirpath, function (err) {
                            if (err) {
                                console.log('Removing dir ' + outdirpath + ': ' + err);
                            }
                            next(topError, zipfile);
                        });
                    });
                }
            });
        },
        function finalStep (err, zipfile) {
            callback(err, zipfile);
        }
    );
};

module.exports = ShpFormat;
