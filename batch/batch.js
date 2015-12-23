'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var JobRunner = require('./job_runner');
var JobQueuePool = require('./job_queue_pool');
var JobQueueConsumer = require('./job_queue_consumer');
var JobSubscriber = require('./job_subscriber');
var UserDatabaseMetadataService = require('./user_database_metadata_service');

function Batch(metadataBackend) {
    EventEmitter.call(this);
    this.metadataBackend = metadataBackend;
    this.jobSubscriber = new JobSubscriber();
    this.userDatabaseMetadataService = new UserDatabaseMetadataService(this.metadataBackend);
    this.jobRunner = new JobRunner(this.metadataBackend, this.userDatabaseMetadataService);
}
util.inherits(Batch, EventEmitter);

Batch.prototype.start = function () {
    var self = this;
    var jobRunner = this.jobRunner;
    var metadataBackend = this.metadataBackend;
    var jobQueuePool = new JobQueuePool();

    // subscribe to message exchange broker in order to know what queues are available
    this.jobSubscriber.subscribe(function onMessage(channel, host) {
        var jobQueueConsumer = jobQueuePool.get(host);

        // if queue consumer is not registered yet
        if (!jobQueueConsumer) {

            // creates new one
            jobQueueConsumer = new JobQueueConsumer(metadataBackend, host);

            // register it in batch service
            jobQueuePool.add(host, jobQueueConsumer);

            // while read from queue then perform job
            jobQueueConsumer.on('data', function (job_id) {

                // limit one job at the same time per queue (queue <1:1> db intance)
                jobQueueConsumer.pause();

                var job = jobRunner.run(job_id);

                job.on('done', function () {
                    // next job
                    self.emit('job:done', job_id);
                    jobQueueConsumer.resume();
                });

                job.on('error', function (err) {
                    console.error(err.stack || err);
                    self.emit('job:failed', job_id);
                    jobQueueConsumer.resume();
                });

            })
            .on('error', function (err) {
                console.error(err.stack || err);
                jobQueuePool.remove(host);
            })
            .on('end', function () {
                jobQueuePool.remove(host);
            });
        }
    });
};

Batch.prototype.stop = function () {
    this.jobSubscriber.unsubscribe();
};

module.exports = Batch;
