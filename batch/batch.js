'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var debug = require('./util/debug')('batch');
var queue = require('queue-async');
var HostUserQueueMover = require('./maintenance/host-user-queue-mover');
var HostScheduler = require('./scheduler/host-scheduler');

var EMPTY_QUEUE = true;

function Batch(name, jobSubscriber, jobQueue, jobRunner, jobService, jobPublisher, redisPool, logger) {
    EventEmitter.call(this);
    this.name = name || 'batch';
    this.jobSubscriber = jobSubscriber;
    this.jobQueue = jobQueue;
    this.jobRunner = jobRunner;
    this.jobService = jobService;
    this.jobPublisher = jobPublisher;
    this.logger = logger;
    this.hostScheduler = new HostScheduler(name, { run: this.processJob.bind(this) }, redisPool);
    this.hostUserQueueMover = new HostUserQueueMover(jobQueue, jobService, this.locker, redisPool);

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
            debug('[%s] onJobHandler(%s, %s)', self.name, user, host);
            self.hostScheduler.add(host, user, function(err) {
                if (err) {
                    return debug(
                        'Could not schedule host=%s user=%s from %s. Reason: %s',
                        host, self.name, user, err.message
                    );
                }
            });
        },
        function onJobSubscriberReady(err) {
            if (err) {
                return self.emit('error', err);
            }

            self.emit('ready');
        }
    );
};

Batch.prototype.processJob = function (user, callback) {
    var self = this;
    self.jobQueue.dequeue(user, function (err, jobId) {
        if (err) {
            return callback(new Error('Could not dequeue job from user "' + user + '". Reason: ' + err.message));
        }

        if (!jobId) {
            debug('Queue empty user=%s', user);
            return callback(null, EMPTY_QUEUE);
        }

        self.setWorkInProgressJob(user, jobId);
        self.jobRunner.run(jobId, function (err, job) {
            self.clearWorkInProgressJob(user);

            if (err) {
                debug(err);
                if (err.name === 'JobNotRunnable') {
                    return callback(null, !EMPTY_QUEUE);
                }
                return callback(err);
            }

            debug(
                '[%s] Job=%s status=%s user=%s (failed_reason=%s)',
                self.name, jobId, job.data.status, user, job.failed_reason
            );

            self.logger.log(job);

            return callback(null, !EMPTY_QUEUE);
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
