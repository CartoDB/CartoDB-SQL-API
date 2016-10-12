'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var debug = require('./util/debug')('batch');
var forever = require('./util/forever');
var queue = require('queue-async');
var Locker = require('./leader/locker');

function Batch(name, jobSubscriber, jobQueue, jobRunner, jobService, jobPublisher, redisConfig, logger) {
    EventEmitter.call(this);
    this.name = name || 'batch';
    this.jobSubscriber = jobSubscriber;
    this.jobQueue = jobQueue;
    this.jobRunner = jobRunner;
    this.jobService = jobService;
    this.jobPublisher = jobPublisher;
    this.logger = logger;
    this.locker = Locker.create('redis-distlock', { redisConfig: redisConfig });

    // map: host => jobId
    this.workingQueues = {};
}
util.inherits(Batch, EventEmitter);

module.exports = Batch;

Batch.prototype.start = function () {
    var self = this;

    this.jobSubscriber.subscribe(
        function onJobHandler(host) {
            if (self.isProcessingHost(host)) {
                return debug('%s is already processing host=%s', self.name, host);
            }

            // do forever, it does not throw a stack overflow
            forever(
                function (next) {
                    self.locker.lock(host, function(err) {
                        // we didn't get the lock for the host
                        if (err) {
                            debug('Could not lock host=%s from %s. Reason: %s', host, self.name, err.message);
                            return next(err);
                        }
                        debug('Locked host=%s from %s', host, self.name);
                        self.processNextJob(host, next);
                    });
                },
                function (err) {
                    debug(err);
                    self.finishedProcessingHost(host);
                    self.locker.unlock(host, debug);
                }
            );
        },
        function onJobSubscriberReady(err) {
            if (err) {
                return self.emit('error', err);
            }

            self.emit('ready');
        }
    );
};

Batch.prototype.processNextJob = function (host, callback) {
    var self = this;
    self.jobQueue.dequeue(host, function (err, jobId) {
        if (err) {
            return callback(err);
        }

        if (!jobId) {
            var emptyQueueError = new Error('Queue ' + host + ' is empty');
            emptyQueueError.name = 'EmptyQueue';
            return callback(emptyQueueError);
        }

        self.setProcessingJobId(host, jobId);

        self.jobRunner.run(jobId, function (err, job) {
            self.setProcessingJobId(host, null);

            if (err) {
                debug(err);
                if (err.name === 'JobNotRunnable') {
                    return callback();
                }
                return callback(err);
            }

            debug('Job[%s] status=%s in host=%s (failed_reason=%s)', jobId, job.data.status, host, job.failed_reason);

            self.logger.log(job);

            self.emit('job:' + job.data.status, jobId);

            callback();
        });
    });
};

Batch.prototype.drain = function (callback) {
    var self = this;
    var workingHosts = this.getWorkingHosts();
    var batchQueues = queue(workingHosts.length);

    workingHosts.forEach(function (host) {
        batchQueues.defer(self._drainJob.bind(self), host);
    });

    batchQueues.awaitAll(function (err) {
        if (err) {
            debug('Something went wrong draining', err);
        } else {
            debug('Drain complete');
        }

        callback();
    });
};

Batch.prototype._drainJob = function (host, callback) {
    var self = this;
    var job_id = this.getProcessingJobId(host);

    if (!job_id) {
        return process.nextTick(function () {
            return callback();
        });
    }

    this.jobService.drain(job_id, function (err) {
        if (err && err.name === 'CancelNotAllowedError') {
            return callback();
        }

        if (err) {
            return callback(err);
        }

        self.jobQueue.enqueueFirst(job_id, host, callback);
    });
};

Batch.prototype.stop = function (callback) {
    this.jobSubscriber.unsubscribe(callback);
};

Batch.prototype.isProcessingHost = function(host) {
    return this.workingQueues.hasOwnProperty(host);
};

Batch.prototype.getWorkingHosts = function() {
    return Object.keys(this.workingQueues);
};

Batch.prototype.setProcessingJobId = function(host, jobId) {
    this.workingQueues[host] = jobId;
};

Batch.prototype.getProcessingJobId = function(host) {
    return this.workingQueues[host];
};

Batch.prototype.finishedProcessingHost = function(host) {
    delete this.workingQueues[host];
};
