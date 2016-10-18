'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var debug = require('./util/debug')('batch');
var forever = require('./util/forever');
var queue = require('queue-async');
var Locker = require('./leader/locker');
var HostUserQueueMover = require('./maintenance/host-user-queue-mover');

function Batch(name, jobSubscriber, jobQueue, jobRunner, jobService, jobPublisher, redisPool, logger) {
    EventEmitter.call(this);
    this.name = name || 'batch';
    this.jobSubscriber = jobSubscriber;
    this.jobQueue = jobQueue;
    this.jobRunner = jobRunner;
    this.jobService = jobService;
    this.jobPublisher = jobPublisher;
    this.logger = logger;
    this.locker = Locker.create('redis-distlock', { pool: redisPool });
    this.hostUserQueueMover = new HostUserQueueMover(jobQueue, jobService, this.locker, redisPool);

    // map: host => map{user}. Useful to determine pending queued users.
    this.workingHosts = {};

    // map: user => jobId. Will be used for draining jobs.
    this.workInProgressJobs = {};
}
util.inherits(Batch, EventEmitter);

module.exports = Batch;

Batch.prototype.start = function () {
    this.hostUserQueueMover.moveOldJobs(function() {
        this.subscribe();
    }.bind(this));
};

Batch.prototype.subscribe = function () {
    var self = this;

    this.jobSubscriber.subscribe(
        function onJobHandler(user, host) {
            debug('onJobHandler(%s, %s)', user, host);
            if (self.isProcessing(host, user)) {
                return debug('%s is already processing host=%s user=%s', self.name, host, user);
            }

            self.setProcessing(host, user);

            // do forever, it does not throw a stack overflow
            forever(
                function (next) {
                    self.locker.lock(host, function(err) {
                        // we didn't get the lock for the host
                        if (err) {
                            debug('Could not lock host=%s from %s. Reason: %s', host, self.name, err.message);
                            return next(err);
                        }
                        debug('Locked host=%s from %s', host, user, self.name);
                        self.processNextJob(user, next);
                    });
                },
                function (err) {
                    if (err) {
                        debug(err.name === 'EmptyQueue' ? err.message : err);
                    }

                    self.clearProcessing(host, user);
                    if (!self.hasPendingJobs(host)) {
                        self.locker.unlock(host, debug);
                    }
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

Batch.prototype.processNextJob = function (user, callback) {
    // This is missing the logic for processing several users within the same host
    // It requires to:
    //  - Take care of number of jobs running at the same time per host.
    //  - Execute user jobs in order.
    var self = this;
    self.jobQueue.dequeue(user, function (err, jobId) {
        if (err) {
            return callback(err);
        }

        if (!jobId) {
            var emptyQueueError = new Error('Queue for user="' + user + '" is empty');
            emptyQueueError.name = 'EmptyQueue';
            return callback(emptyQueueError);
        }

        self.setWorkInProgressJob(user, jobId);
        self.jobRunner.run(jobId, function (err, job) {
            self.clearWorkInProgressJob(user);

            if (err) {
                debug(err);
                if (err.name === 'JobNotRunnable') {
                    return callback();
                }
                return callback(err);
            }

            debug('Job=%s status=%s user=%s (failed_reason=%s)', jobId, job.data.status, user, job.failed_reason);

            self.logger.log(job);

            callback();
        });
    });
};

Batch.prototype.drain = function (callback) {
    var self = this;
    var workingUsers = this.getWorkInProgressUsers();
    var batchQueues = queue(workingUsers.length);

    workingUsers.forEach(function (user) {
        batchQueues.defer(self._drainJob.bind(self), user);
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

Batch.prototype._drainJob = function (user, callback) {
    var self = this;
    var job_id = this.getWorkInProgressJob(user);

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

        self.jobQueue.enqueueFirst(user, job_id, callback);
    });
};

Batch.prototype.stop = function (callback) {
    this.removeAllListeners();
    this.jobSubscriber.unsubscribe(callback);
};


/* Processing hosts => users */

Batch.prototype.setProcessing = function(host, user) {
    if (!this.workingHosts.hasOwnProperty(host)) {
        this.workingHosts[host] = {};
    }
    this.workingHosts[host][user] = true;
};

Batch.prototype.clearProcessing = function(host, user) {
    if (this.workingHosts.hasOwnProperty(host)) {
        delete this.workingHosts[host][user];
        if (!this.hasPendingJobs(host)) {
            delete this.workingHosts[host];
        }
    }
};

Batch.prototype.isProcessing = function(host, user) {
    return this.workingHosts.hasOwnProperty(host) && this.workingHosts[host].hasOwnProperty(user);
};

Batch.prototype.hasPendingJobs = function(host) {
    return this.workingHosts.hasOwnProperty(host) && Object.keys(this.workingHosts[host]).length > 0;
};


/* Work in progress jobs */

Batch.prototype.setWorkInProgressJob = function(user, jobId) {
    this.workInProgressJobs[user] = jobId;
};

Batch.prototype.getWorkInProgressJob = function(user) {
    return this.workInProgressJobs[user];
};

Batch.prototype.clearWorkInProgressJob = function(user) {
    delete this.workInProgressJobs[user];
};

Batch.prototype.getWorkInProgressUsers = function() {
    return Object.keys(this.workInProgressJobs);
};
