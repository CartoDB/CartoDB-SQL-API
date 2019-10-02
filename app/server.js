'use strict';

const express = require('express');
const fs = require('fs');
const mkdirp = require('mkdirp');
const RedisPool = require('redis-mpool');
const cartodbRedis = require('cartodb-redis');
const Logger = require('./services/logger');
const ApiRouter = require('./controllers/api-router');
const HealthCheckController = require('./controllers/health_check_controller');
const VersionController = require('./controllers/version_controller');
const batchFactory = require('../batch');

process.env.PGAPPNAME = process.env.PGAPPNAME || 'cartodb_sqlapi';

// override Date.toJSON
require('./utils/date_to_json');

// jshint maxcomplexity:9
module.exports = function createServer (statsClient) {
    const app = express();
    const redisPool = new RedisPool({
        name: 'sql-api',
        host: global.settings.redis_host,
        port: global.settings.redis_port,
        max: global.settings.redisPool,
        idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
        reapIntervalMillis: global.settings.redisReapIntervalMillis
    });
    const metadataBackend = cartodbRedis({ pool: redisPool });

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

    // TODO: it's here becouse of testing purposes, try to move to top level
    global.settings.tmpDir = global.settings.tmpDir || '/tmp';
    if (!fs.existsSync(global.settings.tmpDir)) {
        mkdirp.sync(global.settings.tmpDir);
    }

    app.enable('jsonp callback');
    app.set("trust proxy", true);
    app.disable('x-powered-by');
    app.disable('etag');

    const dataIngestionLogger = new Logger(global.settings.dataIngestionLogPath, 'data-ingestion');
    app.dataIngestionLogger = dataIngestionLogger;

    // FIXME: health controller should be atached to the main entry point: "/"
    // instead of "/api/v1/" or "/user/:user/api/:version"
    const healthCheckController = new HealthCheckController({
        routes: global.settings.routes.api
    });
    healthCheckController.route(app);

    // FIXME: version controller should be atached to the main entry point: "/"
    // instead of "/api/:version" or "/user/:user/api/:version"
    const versionController = new VersionController({
        routes: global.settings.routes.api
    });
    versionController.route(app);

    const apiRouter = new ApiRouter({
        routes: global.settings.routes,
        redisPool,
        metadataBackend,
        statsClient,
        dataIngestionLogger
    });
    apiRouter.route(app);

    const isBatchProcess = process.argv.indexOf('--no-batch') === -1;

    if (global.settings.environment !== 'test' && isBatchProcess) {
        const batchName = global.settings.api_hostname || 'batch';

        app.batch = batchFactory(
            metadataBackend, redisPool, batchName, statsClient, global.settings.batch_log_filename
        );

        app.batch.start();
    }

    return app;
};
