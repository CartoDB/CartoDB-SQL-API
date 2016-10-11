'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var debug = require('./util/debug')('batch');
var forever = require('./util/forever');
var queue = require('queue-async');
var Locker = require('./leader/locker');

function Batch(name, jobSubscriber, jobQueuePool, jobRunner, jobService, jobPublisher, redisConfig, logger) {
    EventEmitter.call(this);
    this.name = name || 'batch';
    this.jobSubscriber = jobSubscriber;
    this.jobQueuePool = jobQueuePool;
    this.jobRunner = jobRunner;
    this.jobService = jobService;
    this.jobPublisher = jobPublisher;
    this.logger = logger;
    this.locker = Locker.create('redis-distlock', { redisConfig: redisConfig });
}
util.inherits(Batch, EventEmitter);

module.exports = Batch;

Batch.prototype.start = function () {
    this._subscribe();
};

Batch.prototype._subscribe = function () {
    var self = this;

    this.jobSubscriber.subscribe(function onJobHandler(host) {
        var queue = self.jobQueuePool.getQueue(host);

        // there is nothing to do. It is already running jobs
        if (queue) {
            return;
        }
        queue = self.jobQueuePool.createQueue(host);

        // do forever, it does not throw a stack overflow
        forever(function (next) {
            self._consumeJobs(host, queue, next);
        }, function (err) {
            self.jobQueuePool.removeQueue(host);

            if (err.name === 'EmptyQueue') {
                return debug(err.message);
            }

            debug(err);
        });
    }, function (err) {
        if (err) {
            return self.emit('error', err);
        }

        self.emit('ready');
    });
};


Batch.prototype._consumeJobs = function (host, queue, callback) {
    var self = this;
    this.locker.lock(host, 5000, function(err) {
        // we didn't get the lock for the host
        if (err) {
            debug('On de-queue could not lock host=%s from %s. Reason: %s', host, self.name, err.message);
            // In case we have lost the lock but there are pending jobs we re-announce the host
            self.jobPublisher.publish(host);
            return callback(new Error('Could not acquire lock for host=' + host));
        }

        debug('On de-queue locked host=%s from %s', host, self.name);

        var lockRenewalIntervalId = setInterval(function() {
            debug('Trying to extend lock host=%s', host);
            self.locker.lock(host, 5000, function(err, _lock) {
                if (err) {
                    clearInterval(lockRenewalIntervalId);
                    return callback(err);
                }
                if (!err && _lock) {
                    debug('Extended lock host=%s', host);
                }
            });
        }, 1000);

        queue.dequeue(host, function (err, job_id) {
            if (err) {
                return callback(err);
            }

            if (!job_id) {
                clearInterval(lockRenewalIntervalId);
                return self.locker.unlock(host, function() {
                    var emptyQueueError = new Error('Queue ' + host + ' is empty');
                    emptyQueueError.name = 'EmptyQueue';
                    return callback(emptyQueueError);
                });
            }

            self.jobQueuePool.setCurrentJobId(host, job_id);

            self.jobRunner.run(job_id, function (err, job) {
                self.jobQueuePool.removeCurrentJobId(host);

                if (err && err.name === 'JobNotRunnable') {
                    debug(err.message);
                    clearInterval(lockRenewalIntervalId);
                    return callback();
                }

                if (err) {
                    clearInterval(lockRenewalIntervalId);
                    return callback(err);
                }

                debug('Job[%s] status=%s in host=%s (error=%s)', job_id, job.data.status, host, job.failed_reason);

                self.logger.log(job);

                self.emit('job:' + job.data.status, job_id);

                clearInterval(lockRenewalIntervalId);
                callback();
            });
        });
    });
};

Batch.prototype.drain = function (callback) {
    var self = this;
    var queues = this.jobQueuePool.list();
    var batchQueues = queue(queues.length);

    queues.forEach(function (host) {
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
    var job_id = self.jobQueuePool.getCurrentJobId(host);

    if (!job_id) {
        return process.nextTick(function () {
            return callback();
        });
    }

    var queue = self.jobQueuePool.getQueue(host);

    this.jobService.drain(job_id, function (err) {
        if (err && err.name === 'CancelNotAllowedError') {
            return callback();
        }

        if (err) {
            return callback(err);
        }

        queue.enqueueFirst(job_id, host, callback);
    });
};

Batch.prototype.stop = function () {
    this.jobSubscriber.unsubscribe();
};
