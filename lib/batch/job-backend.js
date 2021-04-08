'use strict';

var REDIS_PREFIX = 'batch:jobs:';
var REDIS_DB = global.settings.batch_db || 5;
var JobStatus = require('./job-status');
var queue = require('queue-async');

function JobBackend (metadataBackend, jobQueue, logger) {
    this.metadataBackend = metadataBackend;
    this.jobQueue = jobQueue;
    this.maxNumberOfQueuedJobs = global.settings.batch_max_queued_jobs || 64;
    this.inSecondsJobTTLAfterFinished = global.settings.finished_jobs_ttl_in_seconds || 2 * 3600; // 2 hours
    this.hostname = global.settings.api_hostname || 'batch';
    this.logger = logger;
}

function toRedisParams (job) {
    var redisParams = [REDIS_PREFIX + job.job_id];
    var obj = JSON.parse(JSON.stringify(job));
    delete obj.job_id;

    for (var property in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, property)) {
            redisParams.push(property);
            if (property === 'query' && typeof obj[property] !== 'string') {
                redisParams.push(JSON.stringify(obj[property]));
            } else {
                redisParams.push(obj[property]);
            }
        }
    }

    return redisParams;
}

function toObject (jobId, redisParams, redisValues) {
    var obj = {};

    redisParams.shift(); // job_id value
    redisParams.pop(); // WARN: weird function pushed by metadataBackend

    for (var i = 0; i < redisParams.length; i++) {
        // TODO: this should be moved to job model
        if (redisParams[i] === 'query') {
            try {
                obj[redisParams[i]] = JSON.parse(redisValues[i]);
            } catch (e) {
                obj[redisParams[i]] = redisValues[i];
            }
        } else if (redisValues[i]) {
            obj[redisParams[i]] = redisValues[i];
        }
    }

    obj.job_id = jobId; // adds redisKey as object property

    return obj;
}

function isJobFound (redisValues) {
    return !!(redisValues[0] && redisValues[1] && redisValues[2] && redisValues[3] && redisValues[4]);
}

function getNotFoundError (jobId) {
    var notFoundError = new Error('Job with id ' + jobId + ' not found');
    notFoundError.name = 'NotFoundError';
    return notFoundError;
}

JobBackend.prototype.get = function (jobId, callback) {
    if (!jobId) {
        return callback(getNotFoundError(jobId));
    }

    var self = this;
    var redisParams = [
        REDIS_PREFIX + jobId,
        'user',
        'status',
        'query',
        'created_at',
        'updated_at',
        'host',
        'failed_reason',
        'fallback_status',
        'host',
        'port',
        'pass',
        'dbname',
        'dbuser'
    ];

    self.metadataBackend.redisCmd(REDIS_DB, 'HMGET', redisParams, function (err, redisValues) {
        if (err) {
            return callback(err);
        }

        if (!isJobFound(redisValues)) {
            return callback(getNotFoundError(jobId));
        }

        var jobData = toObject(jobId, redisParams, redisValues);

        callback(null, jobData);
    });
};

JobBackend.prototype.create = function (job, callback) {
    var self = this;

    this.jobQueue.size(job.user, function (err, size) {
        if (err) {
            return callback(new Error('Failed to create job, could not determine user queue size'));
        }

        if (size >= self.maxNumberOfQueuedJobs) {
            return callback(new Error(
                'Failed to create job. ' +
                'Max number of jobs (' + self.maxNumberOfQueuedJobs + ') queued reached'
            ));
        }

        self.get(job.job_id, function (err) {
            if (err && err.name !== 'NotFoundError') {
                return callback(err);
            }

            self.save(job, function (err, jobSaved) {
                if (err) {
                    return callback(err);
                }

                self.jobQueue.enqueue(job.user, job.job_id, function (err) {
                    if (err) {
                        return callback(err);
                    }

                    return callback(null, jobSaved);
                });
            });
        });
    });
};

JobBackend.prototype.update = function (job, callback) {
    var self = this;

    self.get(job.job_id, function (err) {
        if (err) {
            return callback(err);
        }

        self.save(job, callback);
    });
};

JobBackend.prototype.save = function (job, callback) {
    var self = this;
    var redisParams = toRedisParams(job);

    self.metadataBackend.redisCmd(REDIS_DB, 'HMSET', redisParams, function (err) {
        if (err) {
            return callback(err);
        }

        self.setTTL(job, function (err) {
            if (err) {
                return callback(err);
            }

            self.get(job.job_id, function (err, job) {
                if (err) {
                    return callback(err);
                }

                callback(null, job);
            });
        });
    });
};

var WORK_IN_PROGRESS_JOB = {
    DB: global.settings.batch_db || 5,
    PREFIX_USER: 'batch:wip:user:',
    USER_INDEX_KEY: 'batch:wip:users'
};

JobBackend.prototype.addWorkInProgressJob = function (user, jobId, callback) {
    var userWIPKey = WORK_IN_PROGRESS_JOB.PREFIX_USER + user;
    this.logger.debug('add job %s to user %s (%s)', jobId, user, userWIPKey);
    this.metadataBackend.redisMultiCmd(WORK_IN_PROGRESS_JOB.DB, [
        ['SADD', WORK_IN_PROGRESS_JOB.USER_INDEX_KEY, user],
        ['RPUSH', userWIPKey, jobId]
    ], callback);
};

JobBackend.prototype.clearWorkInProgressJob = function (user, jobId, callback) {
    var self = this;
    var DB = WORK_IN_PROGRESS_JOB.DB;
    var userWIPKey = WORK_IN_PROGRESS_JOB.PREFIX_USER + user;

    var params = [userWIPKey, 0, jobId];
    self.metadataBackend.redisCmd(DB, 'LREM', params, function (err) {
        if (err) {
            return callback(err);
        }

        params = [userWIPKey, 0, -1];
        self.metadataBackend.redisCmd(DB, 'LRANGE', params, function (err, workInProgressJobs) {
            if (err) {
                return callback(err);
            }

            self.logger.debug('user %s has work in progress jobs %j', user, workInProgressJobs);

            if (workInProgressJobs.length < 0) {
                return callback();
            }

            self.logger.debug('delete user %s from index', user);

            params = [WORK_IN_PROGRESS_JOB.USER_INDEX_KEY, user];
            self.metadataBackend.redisCmd(DB, 'SREM', params, function (err) {
                if (err) {
                    return callback(err);
                }

                return callback();
            });
        });
    });
};

JobBackend.prototype.listWorkInProgressJobByUser = function (user, callback) {
    var userWIPKey = WORK_IN_PROGRESS_JOB.PREFIX_USER + user;
    var params = [userWIPKey, 0, -1];
    this.metadataBackend.redisCmd(WORK_IN_PROGRESS_JOB.DB, 'LRANGE', params, callback);
};

JobBackend.prototype.listWorkInProgressJobs = function (callback) {
    var self = this;
    var DB = WORK_IN_PROGRESS_JOB.DB;

    var params = [WORK_IN_PROGRESS_JOB.USER_INDEX_KEY];
    this.metadataBackend.redisCmd(DB, 'SMEMBERS', params, function (err, workInProgressUsers) {
        if (err) {
            return callback(err);
        }

        if (workInProgressUsers < 1) {
            return callback(null, {});
        }

        self.logger.debug('found %j work in progress users', workInProgressUsers);

        var usersQueue = queue(4);

        workInProgressUsers.forEach(function (user) {
            usersQueue.defer(self.listWorkInProgressJobByUser.bind(self), user);
        });

        usersQueue.awaitAll(function (err, userWorkInProgressJobs) {
            if (err) {
                return callback(err);
            }

            var workInProgressJobs = workInProgressUsers.reduce(function (users, user, index) {
                users[user] = userWorkInProgressJobs[index];
                self.logger.debug('found %j work in progress jobs for user %s', userWorkInProgressJobs[index], user);
                return users;
            }, {});

            callback(null, workInProgressJobs);
        });
    });
};

JobBackend.prototype.setTTL = function (job, callback) {
    var self = this;
    var redisKey = REDIS_PREFIX + job.job_id;

    if (!JobStatus.isFinal(job.status)) {
        return callback();
    }

    self.metadataBackend.redisCmd(REDIS_DB, 'EXPIRE', [redisKey, this.inSecondsJobTTLAfterFinished], callback);
};

module.exports = JobBackend;
