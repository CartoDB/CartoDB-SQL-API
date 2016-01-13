'use strict';

var JobRunner = require('./job_runner');
var JobCanceller = require('./job_canceller');
var JobQueuePool = require('./job_queue_pool');
var JobSubscriber = require('./job_subscriber');
var UserDatabaseMetadataService = require('./user_database_metadata_service');
var JobPublisher = require('./job_publisher');
var JobQueue = require('./job_queue');
var UserIndexer = require('./user_indexer');
var JobBackend = require('./job_backend');
var Batch = require('./batch');

module.exports = function batchFactory (metadataBackend) {
    var jobSubscriber = new JobSubscriber();
    var jobQueuePool = new JobQueuePool(metadataBackend);
    var jobPublisher = new JobPublisher();
    var jobQueue =  new JobQueue(metadataBackend);
    var userIndexer = new UserIndexer(metadataBackend);
    var jobBackend = new JobBackend(metadataBackend, jobQueue, jobPublisher, userIndexer);
    var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
    var jobRunner = new JobRunner(jobBackend, userDatabaseMetadataService);
    var jobCanceller = new JobCanceller(metadataBackend, userDatabaseMetadataService, jobBackend);

    return new Batch(jobSubscriber, jobQueuePool, jobRunner, jobCanceller);
};
