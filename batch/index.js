'use strict';

var redis = require('redis');
var JobRunner = require('./job_runner');
var QueryRunner = require('./query_runner');
var JobCanceller = require('./job_canceller');
var JobQueuePool = require('./job_queue_pool');
var JobSubscriber = require('./job_subscriber');
var QueueSeeker = require('./queue_seeker');
var UserDatabaseMetadataService = require('./user_database_metadata_service');
var JobPublisher = require('./job_publisher');
var JobQueue = require('./job_queue');
var UserIndexer = require('./user_indexer');
var JobBackend = require('./job_backend');
var JobService = require('./job_service');
var Batch = require('./batch');

module.exports = function batchFactory (metadataBackend) {
    var queueSeeker = new QueueSeeker(metadataBackend);
    var jobSubscriber = new JobSubscriber(redis, queueSeeker);
    var jobQueuePool = new JobQueuePool(metadataBackend);
    var jobPublisher = new JobPublisher(redis);
    var jobQueue =  new JobQueue(metadataBackend);
    var userIndexer = new UserIndexer(metadataBackend);
    var jobBackend = new JobBackend(metadataBackend, jobQueue, jobPublisher, userIndexer);
    var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
    var queryRunner = new QueryRunner(userDatabaseMetadataService);
    var jobCanceller = new JobCanceller(userDatabaseMetadataService);
    var jobService = new JobService(jobBackend, jobCanceller);
    var jobRunner = new JobRunner(jobService, jobQueue, queryRunner);

    return new Batch(jobSubscriber, jobQueuePool, jobRunner, jobService);
};
