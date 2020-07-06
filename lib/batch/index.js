'use strict';

var JobRunner = require('./job-runner');
var QueryRunner = require('./query-runner');
var JobCanceller = require('./job-canceller');
var JobSubscriber = require('./pubsub/job-subscriber');
var UserDatabaseMetadataService = require('./user-database-metadata-service');
var JobPublisher = require('./pubsub/job-publisher');
var JobQueue = require('./job-queue');
var JobBackend = require('./job-backend');
var JobService = require('./job-service');
var Batch = require('./batch');

module.exports = function batchFactory (metadataBackend, redisPool, name, statsdClient, logger) {
    var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);

    var jobSubscriber = new JobSubscriber(redisPool);
    var jobPublisher = new JobPublisher(redisPool);

    var jobQueue = new JobQueue(metadataBackend, jobPublisher, logger);
    var jobBackend = new JobBackend(metadataBackend, jobQueue, logger);
    var queryRunner = new QueryRunner(userDatabaseMetadataService, logger);
    var jobCanceller = new JobCanceller();
    var jobService = new JobService(jobBackend, jobCanceller, logger);
    var jobRunner = new JobRunner(jobService, jobQueue, queryRunner, metadataBackend, statsdClient);

    return new Batch(
        name,
        userDatabaseMetadataService,
        jobSubscriber,
        jobQueue,
        jobRunner,
        jobService,
        redisPool,
        logger
    );
};
