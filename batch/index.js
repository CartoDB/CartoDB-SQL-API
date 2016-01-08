'use strict';

var JobRunner = require('./job_runner');
var JobQueuePool = require('./job_queue_pool');
var JobSubscriber = require('./job_subscriber');
var UserDatabaseMetadataService = require('./user_database_metadata_service');
var JobPublisher = require('./job_publisher');
var JobQueue = require('./job_queue');
var UserIndexer = require('./user_indexer');

var Batch = require('./batch');

module.exports = function batchFactory (metadataBackend) {
    var jobSubscriber = new JobSubscriber();
    var jobQueuePool = new JobQueuePool(metadataBackend);

    var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
    var jobPublisher = new JobPublisher();
    var jobQueue =  new JobQueue(metadataBackend);
    var userIndexer = new UserIndexer(metadataBackend);

    var jobRunner = new JobRunner(
        metadataBackend,
        userDatabaseMetadataService,
        jobPublisher,
        jobQueue,
        userIndexer
    );

    return new Batch(jobSubscriber, jobQueuePool, jobRunner);
};
