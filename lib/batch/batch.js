'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var queue = require('queue-async');
var HostScheduler = require('./scheduler/host-scheduler');
var JobStatus = require('./job-status');

var EMPTY_QUEUE = true;

var MINUTE = 60 * 1000;
var SCHEDULE_INTERVAL = 1 * MINUTE;

function Batch (name, userDatabaseMetadataService, jobSubscriber, jobQueue, jobRunner, jobService, redisPool, logger) {
    EventEmitter.call(this);
    this.name = name || 'batch';
    this.userDatabaseMetadataService = userDatabaseMetadataService;
    this.jobSubscriber = jobSubscriber;
    this.jobQueue = jobQueue;
    this.jobRunner = jobRunner;
    this.jobService = jobService;
    this.logger = logger;
    this.hostScheduler = new HostScheduler(this.name, { run: this.processJob.bind(this) }, redisPool);

    // map: user => jobId. Will be used for draining jobs.
    this.workInProgressJobs = {};
}
util.inherits(Batch, EventEmitter);

module.exports = Batch;

Batch.prototype.start = function () {
    var self = this;
    var onJobHandler = createJobHandler(self.name, self.userDatabaseMetadataService, self.hostScheduler, self.logger);

    self.jobQueue.scanQueues(function (err, queues) {
        if (err) {
            return self.emit('error', err);
        }

        queues.forEach(onJobHandler);
        self._startScheduleInterval(onJobHandler);

        self.jobSubscriber.subscribe(onJobHandler, function (err) {
            if (err) {
                return self.emit('error', err);
            }

            self.logger.debug('Batch Queries ready!');
            self.emit('ready');
        });
    });
};

function createJobHandler (name, userDatabaseMetadataService, hostScheduler, logger) {
    return function onJobHandler (user) {
        userDatabaseMetadataService.getUserMetadata(user, function (err, userDatabaseMetadata) {
            if (err) {
                return logger.debug('Could not get host user=%s from %s. Reason: %s', user, name, err.message);
            }

            var host = userDatabaseMetadata.host;

            logger.debug('[%s] onJobHandler(%s, %s)', name, user, host);
            hostScheduler.add(host, user, function (err) {
                if (err) {
                    return logger.debug(
                        'Could not schedule host=%s user=%s from %s. Reason: %s', host, user, name, err.message
                    );
                }
            });
        });
    };
}

Batch.prototype._startScheduleInterval = function (onJobHandler) {
    var self = this;

    self.scheduleInterval = setInterval(function () {
        self.jobQueue.getQueues(function (err, queues) {
            if (err) {
                return self.logger.debug('Could not get queues from %s. Reason: %s', self.name, err.message);
            }

            queues.forEach(onJobHandler);
        });
    }, SCHEDULE_INTERVAL);
};

Batch.prototype._stopScheduleInterval = function () {
    if (this.scheduleInterval) {
        clearInterval(this.scheduleInterval);
    }
};

Batch.prototype.processJob = function (user, callback) {
    var self = this;

    self.jobQueue.dequeue(user, function (err, jobId) {
        if (err) {
            return callback(new Error('Could not get job from "' + user + '". Reason: ' + err.message), !EMPTY_QUEUE);
        }

        if (!jobId) {
            self.logger.debug('Queue empty user=%s', user);
            return callback(null, EMPTY_QUEUE);
        }

        self._processWorkInProgressJob(user, jobId, function (err, job) {
            if (err) {
                self.logger.debug(err);
                if (err.name === 'JobNotRunnable') {
                    return callback(null, !EMPTY_QUEUE);
                }
                return callback(err, !EMPTY_QUEUE);
            }

            if (JobStatus.isFinal(job.data.status)) {
                self.logger.info({ 'cdb-user': user, job: job.toJSON() }, 'Batch query job finished');
            } else {
                self.logger.debug({ 'cdb-user': user, job: job.toJSON() }, 'Batch query job: query done');
            }

            return callback(null, !EMPTY_QUEUE);
        });
    });
};

Batch.prototype._processWorkInProgressJob = function (user, jobId, callback) {
    var self = this;

    self.setWorkInProgressJob(user, jobId, function (errSet) {
        if (errSet) {
            self.logger.debug(new Error('Could not add job to work-in-progress list. Reason: ' + errSet.message));
        }

        self.jobRunner.run(jobId, function (err, job) {
            self.clearWorkInProgressJob(user, jobId, function (errClear) {
                if (errClear) {
                    self.logger.debug(
                        new Error('Could not clear job from work-in-progress list. Reason: ' + errClear.message)
                    );
                }

                return callback(err, job);
            });
        });
    });
};

Batch.prototype.drain = function (callback) {
    var self = this;
    var workingUsers = this.getWorkInProgressUsers();
    var batchQueues = queue(workingUsers.length);

    this.logger.debug('Drain batch-queries processing');

    workingUsers.forEach(function (user) {
        batchQueues.defer(self._drainJob.bind(self), user);
    });

    batchQueues.awaitAll(function (err) {
        if (err) {
            self.logger.debug('Something went wrong draining', err);
        } else {
            self.logger.debug('Drain complete');
        }

        callback();
    });
};

Batch.prototype._drainJob = function (user, callback) {
    var self = this;
    var jobId = this.getWorkInProgressJob(user);

    if (!jobId) {
        return process.nextTick(function () {
            return callback();
        });
    }

    this.jobService.drain(jobId, function (err) {
        if (err && err.name === 'CancelNotAllowedError') {
            return callback();
        }

        if (err) {
            return callback(err);
        }

        self.clearWorkInProgressJob(user, jobId, function (err) {
            if (err) {
                self.logger.debug(new Error('Could not clear job from work-in-progress list. Reason: ' + err.message));
            }

            self.jobQueue.enqueueFirst(user, jobId, callback);
        });
    });
};

Batch.prototype.stop = function (callback) {
    this.logger.debug('Stop batch-queries processing');
    this.removeAllListeners();
    this._stopScheduleInterval();
    this.jobSubscriber.unsubscribe(callback);
};

/* Work in progress jobs */

Batch.prototype.setWorkInProgressJob = function (user, jobId, callback) {
    this.workInProgressJobs[user] = jobId;
    this.jobService.addWorkInProgressJob(user, jobId, callback);
};

Batch.prototype.getWorkInProgressJob = function (user) {
    return this.workInProgressJobs[user];
};

Batch.prototype.clearWorkInProgressJob = function (user, jobId, callback) {
    delete this.workInProgressJobs[user];
    this.jobService.clearWorkInProgressJob(user, jobId, callback);
};

Batch.prototype.getWorkInProgressUsers = function () {
    return Object.keys(this.workInProgressJobs);
};
