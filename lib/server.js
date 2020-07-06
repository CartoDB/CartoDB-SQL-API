'use strict';

const express = require('express');
const fs = require('fs');
const RedisPool = require('redis-mpool');
const cartodbRedis = require('cartodb-redis');
const ApiRouter = require('./api/api-router');
const batchFactory = require('./batch');
const getServerOptions = require('./server-options');

process.env.PGAPPNAME = process.env.PGAPPNAME || 'cartodb_sqlapi';

// override Date.toJSON
require('./utils/date-to-json');

module.exports = function createServer (statsClient) {
    const { routes, logger } = getServerOptions();
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
    global.settings.db_pubuser = global.settings.db_pubuser || 'publicuser';
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
        fs.mkdirSync(global.settings.tmpDir, { recursive: true });
    }

    app.enable('jsonp callback');
    app.set('trust proxy', true);
    app.disable('x-powered-by');
    app.disable('etag');

    const apiRouter = new ApiRouter({
        redisPool,
        metadataBackend,
        statsClient,
        logger
    });
    apiRouter.route(app, routes.api);

    const isBatchProcess = process.argv.indexOf('--no-batch') === -1;

    if (global.settings.environment !== 'test' && isBatchProcess) {
        const batchName = global.settings.api_hostname || 'batch';

        app.batch = batchFactory(metadataBackend, redisPool, batchName, statsClient, logger);
        app.batch.start();
    }

    return app;
};
