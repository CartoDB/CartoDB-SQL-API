'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var forever = require('./forever');

function Batch(jobSubscriber, jobQueuePool, jobRunner) {
    EventEmitter.call(this);
    this.jobSubscriber = jobSubscriber;
    this.jobQueuePool = jobQueuePool;
    this.jobRunner = jobRunner;
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

        // do forever, it does not throw a stack overflow
        forever(function (next) {
            self._consumeJobs(host, queue, next);
        }, function (err) {
            self.jobQueuePool.remove(host);

            if (err.name === 'EmptyQueue') {
                return console.log(err.message);
            }

            console.error(err);
        });
    });
};

Batch.prototype.stop = function () {
    this.jobSubscriber.unsubscribe();
};

Batch.prototype._consumeJobs = function (host, queue, callback) {
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

        self.jobRunner.run(job_id, function (err, job) {
            if (err) {
                return callback(err);
            }

            if (job.status === 'failed') {
                console.log('Job %s %s in %s due to: %s', job_id, job.status, host, job.failed_reason);
            } else {
                console.log('Job %s %s in %s', job_id, job.status, host);
            }

            self.emit('job:' + job.status, job_id);

            callback();
        });
    });
};

module.exports = Batch;
