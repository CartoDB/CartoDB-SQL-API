'use strict';

var Job = require('./job');
var JobQueuePool = require('./job_queue_pool');
var JobQueueConsumer = require('./job_queue_consumer');
var JobSubscriber = require('./job_subscriber');
var UserDatabaseMetadataService = require('./user_database_metadata_service');
var JobService = require('./job_service');

module.exports = function batch(metadataBackend) {
    var jobQueuePool = new JobQueuePool();
    var jobSubscriber = new JobSubscriber();
    var job = new Job();
    var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
    var jobService = new JobService(userDatabaseMetadataService, job);

    jobSubscriber.subscribe(function onMessage(channel, host) {
        var jobQueueConsumer = jobQueuePool.get(host);

        // if queue consumer is not registered in batch service
        if (!jobQueueConsumer) {

            // creates new one
            jobQueueConsumer = new JobQueueConsumer(metadataBackend, host);

            // register it in batch service
            jobQueuePool.add(host, jobQueueConsumer);

            // while read from queue then perform job
            jobQueueConsumer.on('data', function (username) {

                // limit one job at the same time per queue (queue <1:1> db intance)
                jobQueueConsumer.pause();

                jobService.run(username,  function (err) {
                    if (err) {
                        console.error(err.stack);
                    }

                    // next job
                    jobQueueConsumer.resume();
                });
            })
            .on('error', function (err) {
                console.error(err.stack || err);
            });
        }
    });

    return job;
};
