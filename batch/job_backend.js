'use strict';

var REDIS_PREFIX = 'batch:jobs:';
var REDIS_DB = 5;
var JobStatus = require('./job_status');
var queue = require('queue-async');
var debug = require('./util/debug')('job-backend');

function JobBackend(metadataBackend, jobQueue) {
    this.metadataBackend = metadataBackend;
    this.jobQueue = jobQueue;
    this.maxNumberOfQueuedJobs = global.settings.batch_max_queued_jobs || 64;
    this.inSecondsJobTTLAfterFinished = global.settings.finished_jobs_ttl_in_seconds || 2 * 3600; // 2 hours
    this.hostname = global.settings.api_hostname || 'batch';
}

function toRedisParams(job) {
    var redisParams = [REDIS_PREFIX + job.job_id];
    var obj = JSON.parse(JSON.stringify(job));
    delete obj.job_id;

    for (var property in obj) {
        if (obj.hasOwnProperty(property)) {
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

function toObject(job_id, redisParams, redisValues) {
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

    obj.job_id = job_id; // adds redisKey as object property

    return obj;
}

function isJobFound(redisValues) {
    return !!(redisValues[0] && redisValues[1] && redisValues[2] && redisValues[3] && redisValues[4]);
}

JobBackend.prototype.get = function (job_id, callback) {
    var self = this;
    var redisParams = [
        REDIS_PREFIX + job_id,
        'user',
        'status',
        'query',
        'created_at',
        'updated_at',
        'host',
        'failed_reason',
        'fallback_status'
    ];

    self.metadataBackend.redisCmd(REDIS_DB, 'HMGET', redisParams , function (err, redisValues) {
        if (err) {
            return callback(err);
        }

        if (!isJobFound(redisValues)) {
            var notFoundError = new Error('Job with id ' + job_id + ' not found');
            notFoundError.name = 'NotFoundError';
            return callback(notFoundError);
        }

        var jobData = toObject(job_id, redisParams, redisValues);

        callback(null, jobData);
    });
};

JobBackend.prototype.create = function (job, callback) {
    var self = this;

    this.jobQueue.size(job.user, function(err, size) {
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

    self.metadataBackend.redisCmd(REDIS_DB, 'HMSET', redisParams , function (err) {
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
    DB: 5,
    PREFIX_USER: 'batch:wip:user:',
    PREFIX_HOST: 'batch:wip:host:'
};

JobBackend.prototype.addWorkInProgressJob = function (user, jobId, callback) {
    var hostWIPKey = WORK_IN_PROGRESS_JOB.PREFIX_HOST + this.hostname; // will be used for draining jobs.
    var userWIPKey = WORK_IN_PROGRESS_JOB.PREFIX_USER + user; // will be used for listing users and their running jobs

    this.metadataBackend.redisMultiCmd(WORK_IN_PROGRESS_JOB.DB, [
        ['RPUSH', hostWIPKey, jobId],
        ['RPUSH', userWIPKey, jobId]
    ], callback);
};

JobBackend.prototype.listWorkInProgressJobByUser = function (user, callback) {
    var userWIPKey = WORK_IN_PROGRESS_JOB.PREFIX_USER + user;

    this.metadataBackend.redisCmd(WORK_IN_PROGRESS_JOB.DB, 'LRANGE', [userWIPKey, 0, -1], callback);
};

JobBackend.prototype.listWorkInProgressJob = function (callback) {
    var initialCursor = ['0'];
    var users = {};

    this._getWIPByUserKeys(initialCursor, users, function (err, users) {
        if (err) {
            return callback(err);
        }

        var usersName = Object.keys(users);
        var usersQueue = queue(usersName.length);

        usersName.forEach(function (userKey) {
            usersQueue.defer(this.listWorkInProgressJobByUser.bind(this), userKey);
        }.bind(this));

        usersQueue.awaitAll(function (err, results) {
            if (err) {
                return callback(err);
            }

            var usersRes = usersName.reduce(function (users, userName, index) {
                users[userName] = results[index];
                return users;
            }, {});

            callback(null, usersRes);
        });

    }.bind(this));
};

JobBackend.prototype._getWIPByUserKeys = function (cursor, users, callback) {
    var userWIPKeyPattern = WORK_IN_PROGRESS_JOB.PREFIX_USER + '*';
    var scanParams = [cursor[0], 'MATCH', userWIPKeyPattern];

    this.metadataBackend.redisCmd(WORK_IN_PROGRESS_JOB.DB, 'SCAN', scanParams, function (err, currentCursor) {
        if (err) {
            return callback(err);
        }

        var usersKeys = currentCursor[1];
        if (usersKeys) {
            usersKeys.forEach(function (userKey) {
                var user = userKey.substr(WORK_IN_PROGRESS_JOB.PREFIX_USER.length);
                users[user] = userKey;
            });
        }

        var hasMore = currentCursor[0] !== '0';
        if (!hasMore) {
            return callback(null, users);
        }

        this._getWIPByUserKeys(currentCursor, users, callback);
    }.bind(this));
};

JobBackend.prototype.setTTL = function (job, callback) {
    var self = this;
    var redisKey = REDIS_PREFIX + job.job_id;

    if (!JobStatus.isFinal(job.status)) {
        return callback();
    }

    self.metadataBackend.redisCmd(REDIS_DB, 'EXPIRE', [ redisKey, this.inSecondsJobTTLAfterFinished ], callback);
};

module.exports = JobBackend;
