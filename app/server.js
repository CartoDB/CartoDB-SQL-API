'use strict';

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
var Profiler = require('./stats/profiler-proxy');
var _ = require('underscore');
var fs = require('fs');
var mkdirp = require('mkdirp');

var RedisPool = require('redis-mpool');
var cartodbRedis = require('cartodb-redis');
const Logger = require('./services/logger');

const ApiRouter = require('./controllers/api-router');
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
    global.settings.ratelimits = Object.assign(
        {
            rateLimitsEnabled: false,
            endpoints: {
                query: false,
                job_create: false,
                job_get: false,
                job_delete: false,
                copy_from: false,
                copy_to: false
            }
        },
        global.settings.ratelimits
    );

    global.settings.tmpDir = global.settings.tmpDir || '/tmp';
    if (!fs.existsSync(global.settings.tmpDir)) {
        mkdirp.sync(global.settings.tmpDir);
    }

    if (global.log4js) {
        var loggerOpts = {
            buffer: true,
            // log4js provides a tokens solution as expess but in does not provide the request/response in the callback.
            // Thus it is not possible to extract relevant information from them.
            // This is a workaround to be able to access request/response.
            format: function(req, res, format) {
                var logFormat = global.settings.log_format ||
                    ':remote-addr :method :req[Host]:url :status :response-time ms -> :res[Content-Type]';

                return format(logFormat);
            }
        };
        app.use(global.log4js.connectLogger(global.log4js.getLogger(), _.defaults(loggerOpts, {level:'info'})));
    }

    // Use step-profiler
    app.use(function bootstrap$prepareRequestResponse(req, res, next) {
        res.locals = res.locals || {};

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
    if (global.settings.hasOwnProperty('node_socket_timeout')) {
        var timeout = parseInt(global.settings.node_socket_timeout);
        app.use(function(req, res, next) {
            req.connection.setTimeout(timeout);
            next();
        });
    }

    app.enable('jsonp callback');
    app.set("trust proxy", true);
    app.disable('x-powered-by');
    app.disable('etag');

    const dataIngestionLogger = new Logger(global.settings.dataIngestionLogPath, 'data-ingestion');
    app.dataIngestionLogger = dataIngestionLogger;

    var healthCheckController = new HealthCheckController();
    healthCheckController.route(app);

    var versionController = new VersionController();
    versionController.route(app);

    const apiRouter = new ApiRouter({ redisPool, metadataBackend, statsClient, dataIngestionLogger });
    apiRouter.route(app);

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
