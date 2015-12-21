'use strict';

var JobRunner = require('./job_runner');
var JobQueuePool = require('./job_queue_pool');
var JobQueueConsumer = require('./job_queue_consumer');
var JobSubscriber = require('./job_subscriber');
var UserDatabaseMetadataService = require('./user_database_metadata_service');
var EventEmitter = require('events').EventEmitter;

module.exports = function batch(metadataBackend) {
    var jobQueuePool = new JobQueuePool();
    var jobSubscriber = new JobSubscriber();
    var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
    var jobRunner = new JobRunner(metadataBackend, userDatabaseMetadataService);
    var eventEmitter = global.settings.environment === 'test' ? new EventEmitter() : {
        emit: function () {}
    };

    // subscribe to message exchange broker in order to know what queues are available
    jobSubscriber.subscribe(function onMessage(channel, host) {
        var jobQueueConsumer = jobQueuePool.get(host);

        // if queue consumer is not registered yet
        if (!jobQueueConsumer) {

            // creates new one
            jobQueueConsumer = new JobQueueConsumer(metadataBackend, host);

            // register it in batch service
            jobQueuePool.add(host, jobQueueConsumer);

            // while read from queue then perform job
            jobQueueConsumer.on('data', function (jobId) {

                // limit one job at the same time per queue (queue <1:1> db intance)
                jobQueueConsumer.pause();

                var job = jobRunner.run(jobId);

                job.on('done', function () {
                    // next job
                    eventEmitter.emit('job:done', jobId);
                    jobQueueConsumer.resume();
                });

                job.on('error', function (err) {
                    console.error(err.stack || err);
                    eventEmitter.emit('job:failed', jobId);
                    jobQueueConsumer.resume();
                });

            })
            .on('error', function (err) {
                console.error(err.stack || err);
            });
        }
    });

    return eventEmitter;
};
