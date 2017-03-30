// CartoDB SQL API
//
// all requests expect the following URL args:
// - `sql` {String} SQL to execute
//
// for private (read/write) queries:
// - OAuth. Must have proper OAuth 1.1 headers. For OAuth 1.1 spec see Google
//
// eg. /api/v1/?sql=SELECT 1 as one (with a load of OAuth headers or URL arguments)
//
// for public (read only) queries:
// - sql only, provided the subdomain exists in CartoDB and the table's sharing options are public
//
// eg. vizzuality.cartodb.com/api/v1/?sql=SELECT * from my_table
//

var express = require('express');
var bodyParser = require('./middlewares/body-parser');
var Profiler = require('./stats/profiler-proxy');
var _ = require('underscore');
var LRU = require('lru-cache');

var RedisPool = require('redis-mpool');
var cartodbRedis = require('cartodb-redis');
var UserDatabaseService = require('./services/user_database_service');
var JobPublisher = require('../batch/pubsub/job-publisher');
var JobQueue = require('../batch/job_queue');
var JobBackend = require('../batch/job_backend');
var JobCanceller = require('../batch/job_canceller');
var JobService = require('../batch/job_service');

var UserDatabaseMetadataService = require('../batch/user_database_metadata_service');

var cors = require('./middlewares/cors');

var GenericController = require('./controllers/generic_controller');
var QueryController = require('./controllers/query_controller');
var JobController = require('./controllers/job_controller');
var CacheStatusController = require('./controllers/cache_status_controller');
var HealthCheckController = require('./controllers/health_check_controller');
var VersionController = require('./controllers/version_controller');

var batchFactory = require('../batch');

process.env.PGAPPNAME = process.env.PGAPPNAME || 'cartodb_sqlapi';

// override Date.toJSON
require('./utils/date_to_json');

// jshint maxcomplexity:9
function App(statsClient) {

    var app = express();

    var redisPool = new RedisPool({
        name: 'sql-api',
        host: global.settings.redis_host,
        port: global.settings.redis_port,
        max: global.settings.redisPool,
        idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
        reapIntervalMillis: global.settings.redisReapIntervalMillis
    });
    var metadataBackend = cartodbRedis({ pool: redisPool });


    // Set default configuration
    global.settings.db_pubuser = global.settings.db_pubuser || "publicuser";
    global.settings.bufferedRows = global.settings.bufferedRows || 1000;

    var tableCache = LRU({
      // store no more than these many items in the cache
      max: global.settings.tableCacheMax || 8192,
      // consider entries expired after these many milliseconds (10 minutes by default)
      maxAge: global.settings.tableCacheMaxAge || 1000*60*10
    });

    // Size based on https://github.com/CartoDB/cartodb.js/blob/3.15.2/src/geo/layer_definition.js#L72
    var SQL_QUERY_BODY_LOG_MAX_LENGTH = 2000;
    app.getSqlQueryFromRequestBody = function(req) {
        var sqlQuery = req.body && req.body.q;
        if (!sqlQuery) {
            return '';
        }

        if (sqlQuery.length > SQL_QUERY_BODY_LOG_MAX_LENGTH) {
            sqlQuery = sqlQuery.substring(0, SQL_QUERY_BODY_LOG_MAX_LENGTH) + ' [...]';
        }
        return JSON.stringify({q: sqlQuery});
    };

    if ( global.log4js ) {
        var loggerOpts = {
            buffer: true,
            // log4js provides a tokens solution as expess but in does not provide the request/response in the callback.
            // Thus it is not possible to extract relevant information from them.
            // This is a workaround to be able to access request/response.
            format: function(req, res, format) {
                var logFormat = global.settings.log_format ||
                    ':remote-addr :method :req[Host]:url :status :response-time ms -> :res[Content-Type]';

                logFormat = logFormat.replace(/:sql/, app.getSqlQueryFromRequestBody(req));
                return format(logFormat);
            }
        };
        app.use(global.log4js.connectLogger(global.log4js.getLogger(), _.defaults(loggerOpts, {level:'info'})));
    }

    app.use(cors());

    // Use step-profiler
    app.use(function bootstrap$prepareRequestResponse(req, res, next) {
        req.context = req.context || {};

        if (global.settings.api_hostname) {
            res.header('X-Served-By-Host', global.settings.api_hostname);
        }

        var profile = global.settings.useProfiler;
        req.profiler = new Profiler({
            profile: profile,
            statsd_client: statsClient
        });
        next();
    });

    // Set connection timeout
    if ( global.settings.hasOwnProperty('node_socket_timeout') ) {
      var timeout = parseInt(global.settings.node_socket_timeout);
      app.use(function(req, res, next) {
        req.connection.setTimeout(timeout);
        next();
      });
    }

    app.use(bodyParser());
    app.enable('jsonp callback');
    app.set("trust proxy", true);
    app.disable('x-powered-by');
    app.disable('etag');

    // basic routing

    var userDatabaseService = new UserDatabaseService(metadataBackend);

    var jobPublisher = new JobPublisher(redisPool);
    var jobQueue = new JobQueue(metadataBackend, jobPublisher);
    var jobBackend = new JobBackend(metadataBackend, jobQueue);
    var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
    var jobCanceller = new JobCanceller(userDatabaseMetadataService);
    var jobService = new JobService(jobBackend, jobCanceller);

    var genericController = new GenericController();
    genericController.route(app);

    var queryController = new QueryController(userDatabaseService, tableCache, statsClient);
    queryController.route(app);

    var jobController = new JobController(userDatabaseService, jobService, statsClient);
    jobController.route(app);

    var cacheStatusController = new CacheStatusController(tableCache);
    cacheStatusController.route(app);

    var healthCheckController = new HealthCheckController();
    healthCheckController.route(app);

    var versionController = new VersionController();
    versionController.route(app);

    var isBatchProcess = process.argv.indexOf('--no-batch') === -1;

    if (global.settings.environment !== 'test' && isBatchProcess) {
        var batchName = global.settings.api_hostname || 'batch';
        app.batch = batchFactory(
            metadataBackend, redisPool, batchName, statsClient, global.settings.batch_log_filename
        );
        app.batch.start();
    }

    return app;
}

module.exports = App;
