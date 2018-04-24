'use strict';

var _ = require('underscore');
var CachedQueryTables = require('../services/cached-query-tables');

const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const timeoutLimitsMiddleware = require('../middlewares/timeout-limits');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;

// Database requirements
var PSQL = require('cartodb-psql');
var fs = require('fs');

// We need NPM body-parser so we can use the multer and
// still decode the urlencoded 'sql' parameter from
// the POST body
var bodyParser = require('body-parser'); // NPM body-parser

// We need multer to support multi-part POST content
var multer = require('multer');

// The default multer storage engines (file/memory) don't
// do what we need, which is pipe the multer read stream
// straight into the pg-copy write stream, so we use
// a custom storage engine
// var multerpgcopy = require('../utils/multer-pg-copy');
// var upload = multer({ storage: multerpgcopy() });

// Store the uploaded file in the tmp directory, with limits on the
// size of acceptable uploads
var uploadLimits = { fileSize: 1024*1024*1024, fields: 10, files: 1 };
var upload = multer({ storage: multer.diskStorage({}), limits: uploadLimits });

function CopyController(metadataBackend, userDatabaseService, tableCache, statsd_client, userLimitsService) {
    this.metadataBackend = metadataBackend;
    this.statsd_client = statsd_client;
    this.userDatabaseService = userDatabaseService;
    this.queryTables = new CachedQueryTables(tableCache);
    this.userLimitsService = userLimitsService;
}

CopyController.prototype.route = function (app) {
    const { base_url } = global.settings;
    const copyFromMiddlewares = endpointGroup => {
        return [
            initializeProfilerMiddleware('query'),
            userMiddleware(),
            rateLimitsMiddleware(this.userLimitsService, endpointGroup),
            authorizationMiddleware(this.metadataBackend),
            connectionParamsMiddleware(this.userDatabaseService),
            timeoutLimitsMiddleware(this.metadataBackend),
            bodyParser.urlencoded({ extended: true }),
            upload.single('file'),
            this.handleCopyFrom.bind(this),
            errorMiddleware()
        ];
    };

    app.post(`${base_url}/copyfrom`, copyFromMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.QUERY));
};

// jshint maxcomplexity:21
CopyController.prototype.handleCopyFrom = function (req, res, next) {

    // Test with:
    // curl --form file=@package.json --form sql="COPY this FROM STDOUT" http://cdb.localhost.lan:8080/api/v2/copyfrom


    var sql = req.body.sql;
    sql = (sql === "" || _.isUndefined(sql)) ? null : sql;

    // Ensure SQL parameter is not missing
    if (!_.isString(sql)) {
        throw new Error("Parameter 'sql' is missing");
    }
    
    // Only accept SQL that starts with 'COPY'
    if (!sql.toUpperCase().startsWith("COPY ")) {
        throw new Error("SQL must start with COPY");
    }
    
    // If SQL doesn't include "from stdin", add it
    if (!sql.toUpperCase().endsWith(" FROM STDOUT")) {
        sql += " FROM STDOUT";
    }
    
    console.debug("CopyController.handleCopyFrom: sql = '%s'", sql);
    
    // The multer middleware should have filled 'req.file' in
    // with the name, size, path, etc of the file
    if (typeof req.file === 'undefined') {
        throw new Error("Parameter 'file' is missing");
    }
    
    try {        
        // Open pgsql COPY pipe and stream file into it
        const { user: username, userDbParams: dbopts, authDbParams, userLimits, authenticated } = res.locals;
        var pg = new PSQL(authDbParams);
        var copyFrom = require('pg-copy-streams').from;
        var copyFromStream = copyFrom(sql);
        // console.debug("XXX connect " + sql);
        pg.dbConnect(pg.getConnectionConfig(), function(err, client, next) {
            var stream = client.query(copyFromStream);
            var fileStream = fs.createReadStream(req.file.path);
            fileStream.on('error', next);
            stream.on('error', next);
            stream.on('end', next);
            fileStream.pipe(stream)
        });
    } catch (err) {
        console.debug("ERRROR!!!!")
        next(err);
    }
        
    // Return some useful information about the process,
    // pg-copy-streams fills in the rowCount after import is complete    
    var result = "handleCopyFrom completed with row count = " + copyFromStream.rowCount;
    console.debug("CopyController.handleCopyFrom: rowCount = '%s'", copyFromStream.rowCount);
    
    res.send(result + "\n");        
};

module.exports = CopyController;
