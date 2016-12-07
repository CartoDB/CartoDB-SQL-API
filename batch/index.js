'use strict';

var JobRunner = require('./job_runner');
var QueryRunner = require('./query_runner');
var JobCanceller = require('./job_canceller');
var JobSubscriber = require('./pubsub/job-subscriber');
var UserDatabaseMetadataService = require('./user_database_metadata_service');
var JobPublisher = require('./pubsub/job-publisher');
var JobQueue = require('./job_queue');
var JobBackend = require('./job_backend');
var JobService = require('./job_service');
var BatchLogger = require('./batch-logger');
var Batch = require('./batch');

module.exports = function batchFactory (metadataBackend, redisPool, name, statsdClient, loggerPath) {
    var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);

    var jobSubscriber = new JobSubscriber(redisPool, userDatabaseMetadataService);
    var jobPublisher = new JobPublisher(redisPool);

    var jobQueue =  new JobQueue(metadataBackend, jobPublisher);
    var jobBackend = new JobBackend(metadataBackend, jobQueue);
    var queryRunner = new QueryRunner(userDatabaseMetadataService);
    var jobCanceller = new JobCanceller(userDatabaseMetadataService);
    var jobService = new JobService(jobBackend, jobCanceller);
    var jobRunner = new JobRunner(jobService, jobQueue, queryRunner, metadataBackend, statsdClient);
    var logger = new BatchLogger(loggerPath);

    return new Batch(
        name,
        jobSubscriber,
        jobQueue,
        jobRunner,
        jobService,
        jobPublisher,
        redisPool,
        logger
    );
};
