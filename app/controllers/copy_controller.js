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

// var upload = multer({ dest: '/tmp/' });

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
CopyController.prototype.handleCopyFrom = function (req, res) {

    // Why doesn't this function do much of anything?
    // Because all the excitement is in the bodyParser and the upload
    // middlewards, the first of which should fill out the body.params.sql
    // statement and the second of which should run that statement and 
    // upload it into pgsql.
    // All that's left here, is to read the number of records inserted
    // and to return some information to the caller on what exactly 
    // happened.
    // Test with:
    // curl --form file=@package.json --form sql="COPY this FROM STDOUT" http://cdb.localhost.lan:8080/api/v2/copyfrom

    req.aborted = false;
    req.on("close", function() {
        if (req.formatter && _.isFunction(req.formatter.cancel)) {
            req.formatter.cancel();
        }
        req.aborted = true; // TODO: there must be a builtin way to check this
    });

    console.debug("CopyController.prototype.handleCopyFrom: sql = '%s'", req.body.sql);

    res.send('got into handleCopyFrom');
        
};

module.exports = CopyController;
