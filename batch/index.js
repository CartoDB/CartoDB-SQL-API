'use strict';

var BatchLauncher = require('./batch_launcher');
var BatchManager = require('./batch_manager');
var JobDequeuer = require('./job_dequeuer');
var QueryRunner = require('./query_runner');
var DatabaseDequeuer = require('./database_dequeuer');
var UserDatabaseQueue = require('./user_database_queue');
var cartoDBRedis = require('cartodb-redis');
var JobCounter = require('./job_counter');

module.exports = function (interval, maxJobsPerHost) {
    var jobCounter = new JobCounter(maxJobsPerHost);

    var metadataBackend = cartoDBRedis({
        host: global.settings.redis_host,
        port: global.settings.redis_port,
        max: global.settings.redisPool,
        idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
        reapIntervalMillis: global.settings.redisReapIntervalMillis
    });

    var userDatabaseQueue = new UserDatabaseQueue(metadataBackend);
    var databaseDequeuer = new DatabaseDequeuer(userDatabaseQueue, metadataBackend, jobCounter);
    var queryRunner = new QueryRunner();
    var jobDequeuer = new JobDequeuer(databaseDequeuer);
    var batchManager = new BatchManager(jobDequeuer, queryRunner);
    var batchLauncher = new BatchLauncher(batchManager);

    // here we go!
    batchLauncher.start(interval);
};
