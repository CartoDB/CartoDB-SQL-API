'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var JobRunner = require('./job_runner');
var JobQueuePool = require('./job_queue_pool');
var JobSubscriber = require('./job_subscriber');
var UserDatabaseMetadataService = require('./user_database_metadata_service');
var forever = require('./forever');

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

        // there is nothing to do. It is already running jobs
        if (queue) {
            return;
        }

        queue = self.jobQueuePool.add(host);

        // do forever, it does not cause a stack overflow
        forever(function (next) {
            self._consume(host, queue, next);
        }, function (err) {
            self.jobQueuePool.remove(host);

            if (err.name === 'EmptyQueue') {
                return console.log(err.message);
            }

            console.error(err);
        });
    });
};

Batch.prototype._consume = function consume(host, queue, callback) {
    var self = this;

    queue.dequeue(host, function (err, job_id) {
        if (err) {
            return callback(err);
        }

        if (!job_id) {
            var emptyQueueError = new Error('Queue ' + host + ' is empty');
            emptyQueueError.name = 'EmptyQueue';
            return callback(emptyQueueError);
        }

        self.jobRunner.run(job_id)
            .on('done', function (job) {
                console.log('Job %s done in %s', job_id, host);
                self.emit('job:done', job.job_id);
                callback();
            })
            .on('failed', function (job) {
                console.log('Job %s failed in %s', job_id, host);
                self.emit('job:failed', job.job_id);
                callback();
            })
            .on('error', function (err) {
                console.error('Error in job %s due to:', job_id, err.message || err);
                self.emit('job:failed', job_id);
                callback();
            });
    });
};

module.exports = Batch;
