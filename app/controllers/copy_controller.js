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
var copyTo = require('pg-copy-streams').to;

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
var multerpgcopy = require('../utils/multer-pg-copy');
var upload = multer({ storage: multerpgcopy() });

// Store the uploaded file in the tmp directory, with limits on the
// size of acceptable uploads
// var uploadLimits = { fileSize: 1024*1024*1024, fields: 10, files: 1 };
// var upload = multer({ storage: multer.diskStorage({}), limits: uploadLimits });

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
            initializeProfilerMiddleware('copyfrom'),
            userMiddleware(),
            rateLimitsMiddleware(this.userLimitsService, endpointGroup),
            authorizationMiddleware(this.metadataBackend),
            connectionParamsMiddleware(this.userDatabaseService),
            timeoutLimitsMiddleware(this.metadataBackend),
            this.copyDbParamsToReq.bind(this),
            bodyParser.urlencoded({ extended: true }),
            upload.single('file'),
            this.handleCopyFrom.bind(this),
            errorMiddleware()
        ];
    };
    
    const copyToMiddlewares = endpointGroup => {
        return [
            initializeProfilerMiddleware('copyto'),
            userMiddleware(),
            rateLimitsMiddleware(this.userLimitsService, endpointGroup),
            authorizationMiddleware(this.metadataBackend),
            connectionParamsMiddleware(this.userDatabaseService),
            timeoutLimitsMiddleware(this.metadataBackend),
            this.handleCopyTo.bind(this),
            errorMiddleware()
        ];
    };

    app.post(`${base_url}/copyfrom`, copyFromMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.QUERY));
    app.get(`${base_url}/copyto`, copyToMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.QUERY));
};

CopyController.prototype.copyDbParamsToReq = function (req, res, next) {

    req.userDbParams = res.locals.userDbParams;
    next();    
};

CopyController.prototype.handleCopyTo = function (req, res, next) {
        
    // curl "http://cdb.localhost.lan:8080/api/v2/copyto?sql=copy+foo+to+stdout&filename=output.dmp"
        
    var sql = req.query.sql;
    var filename = req.query.filename;
    sql = (sql === "" || _.isUndefined(sql)) ? null : sql;
    
    // Ensure SQL parameter is not missing
    if (!_.isString(sql)) {
        throw new Error("Parameter 'sql' is missing");
    }
        
    // Only accept SQL that starts with 'COPY'
    if (!sql.toUpperCase().startsWith("COPY ")) {
        throw new Error("SQL must start with COPY");
    }
    
    try {        
        // Open pgsql COPY pipe and stream out to HTTP response
        var pg = new PSQL(res.locals.userDbParams);
        pg.connect(function(err, client, cb) {
            var copyToStream = copyTo(sql);
            var pgstream = client.query(copyToStream);
            res.on('error', next);
            pgstream.on('error', next);
            pgstream.on('end', cb);
            if (_.isString(filename)) {
                var contentDisposition = "attachment; filename=" + encodeURIComponent(filename);
                res.setHeader("Content-Disposition", contentDisposition);
            } else {
                filename = 'carto-sql-copyto.dmp';
                var contentDisposition = "attachment; filename=" + encodeURIComponent(filename);
                res.setHeader("Content-Disposition", contentDisposition);
            }
            res.setHeader("Content-Type", "application/octet-stream");
            pgstream.pipe(res);
        });
    } catch (err) {
        next(err);
    }
    
};


// jshint maxcomplexity:21
CopyController.prototype.handleCopyFrom = function (req, res) {

    // All the action happens in multer, which reads the incoming
    // file into a stream, and then hands it to the custom storage
    // engine defined in multer-pg-copy.js.
    // The storage engine writes the rowCount into req when it's 
    // finished. Hopefully any errors just propogate up.
    
    // curl --form sql="COPY foo FROM STDOUT" http://cdb.localhost.lan:8080/api/v2/copyfrom --form file=@copyfrom.txt 


    if (typeof req.file === "undefined") {
        throw new Error("no rows copied");
    }
    var msg = {time: req.file.time, total_rows: req.file.total_rows};
    if (req.query && req.query.callback) {
        res.jsonp(msg);
    } else {
        res.json(msg);
    }
    
};

module.exports = CopyController;