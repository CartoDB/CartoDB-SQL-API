'use strict';

var JobRunner = require('./job_runner');
var JobQueuePool = require('./job_queue_pool');
var JobQueueConsumer = require('./job_queue_consumer');
var JobSubscriber = require('./job_subscriber');
var UserDatabaseMetadataService = require('./user_database_metadata_service');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

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
    this.jobQueuePool = new JobQueuePool();

    // subscribe to message exchange broker in order to know what queues are available
    this.jobSubscriber.subscribe(function onMessage(channel, host) {
        var jobQueueConsumer = self.jobQueuePool.get(host);

        // if queue consumer is not registered yet
        if (!jobQueueConsumer) {

            // creates new one
            jobQueueConsumer = new JobQueueConsumer(self.metadataBackend, host);

            // register it in batch service
            self.jobQueuePool.add(host, jobQueueConsumer);

            // while read from queue then perform job
            jobQueueConsumer.on('data', function (jobId) {

                // limit one job at the same time per queue (queue <1:1> db intance)
                jobQueueConsumer.pause();

                var job = self.jobRunner.run(jobId);

                job.on('done', function () {
                    // next job
                    self.emit('job:done', jobId);
                    jobQueueConsumer.resume();
                });

                job.on('error', function (err) {
                    console.error(err.stack || err);
                    self.emit('job:failed', jobId);
                    jobQueueConsumer.resume();
                });

            })
            .on('error', function (err) {
                console.error(err.stack || err);
                self.jobQueuePool.remove(host);
            })
            .on('end', function () {
                self.jobQueuePool.remove(host);
            });
        }
    });
};

Batch.prototype.stop = function () {
    this.jobSubscriber.unsubscribe();
};

module.exports = Batch;
