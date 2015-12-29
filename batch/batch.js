'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var JobRunner = require('./job_runner');
var JobQueuePool = require('./job_queue_pool');
var JobSubscriber = require('./job_subscriber');
var UserDatabaseMetadataService = require('./user_database_metadata_service');

function Batch(metadataBackend) {
    EventEmitter.call(this);
    this.jobSubscriber = new JobSubscriber();
    this.jobQueuePool = new JobQueuePool(metadataBackend);
    this.jobRunner = new JobRunner(metadataBackend, new UserDatabaseMetadataService(metadataBackend));
}
util.inherits(Batch, EventEmitter);

Batch.prototype.start = function () {
    var self = this;

    this.jobSubscriber.subscribe(function (channel, host) {
        var queue = self.jobQueuePool.get(host);

        if (!queue) {
            queue = self.jobQueuePool.add(host);
            run(queue);
        }

        function run(queue) {
            queue.dequeue(host, function (err, job_id) {
                if (err) {
                    self.jobQueuePool.remove(host);
                    return console.error(err);
                }

                if (!job_id) {
                    self.jobQueuePool.remove(host);
                    return console.log('Queue %s is empty', host);
                }

                self.jobRunner.run(job_id)
                    .on('done', function (job) {
                        console.log('Job %s done in %s', job_id, host);
                        self.emit('job:done', job_id);
                        run(queue);
                    })
                    .on('failed', function (job) {
                        console.log('Job %s done in %s', job_id, host);
                        self.emit('job:failed', job_id);
                        run(queue);
                    })
                    .on('error', function (err) {
                        self.emit('job:failed', job_id);
                        self.jobQueuePool.remove(host);
                    });
            });
        }
    });
};

module.exports = Batch;
