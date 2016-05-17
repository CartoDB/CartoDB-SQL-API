'use strict';

var queue = require('queue-async');
var REDIS_PREFIX = 'batch:jobs:';
var JOBS_TTL_IN_SECONDS = global.settings.jobs_ttl_in_seconds || 48 * 3600; // 48 hours
var jobStatus = require('./job_status');
var finalStatus = [
    jobStatus.CANCELLED,
    jobStatus.DONE,
    jobStatus.FAILED,
    jobStatus.UNKNOWN
];

function JobBackend(metadataBackend, jobQueueProducer, jobPublisher, userIndexer) {
    this.db = 5;
    this.metadataBackend = metadataBackend;
    this.jobQueueProducer = jobQueueProducer;
    this.jobPublisher = jobPublisher;
    this.userIndexer = userIndexer;
}

JobBackend.prototype.toRedisParams = function (data) {
    var redisParams = [REDIS_PREFIX + data.job_id];
    var obj = JSON.parse(JSON.stringify(data));
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
};

JobBackend.prototype.toObject = function (job_id, redisParams, redisValues) {
    var obj = {};

    redisParams.shift(); // job_id value
    redisParams.pop(); // WARN: weird function pushed by metadataBackend

    for (var i = 0; i < redisParams.length; i++) {
        if (redisParams[i] === 'query') {
            try {
                obj[redisParams[i]] = JSON.parse(redisValues[i]);
            } catch (e) {
                obj[redisParams[i]] = redisValues[i];
            }
        } else {
            obj[redisParams[i]] = redisValues[i];
        }
    }

    obj.job_id = job_id; // adds redisKey as object property

    return obj;
};

// TODO: is it really necessary??
function isJobFound(redisValues) {
    return redisValues[0] && redisValues[1] && redisValues[2] && redisValues[3] && redisValues[4];
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
        'failed_reason'
    ];

    this.metadataBackend.redisCmd(this.db, 'HMGET', redisParams , function (err, redisValues) {
        if (err) {
            return callback(err);
        }

        if (!isJobFound(redisValues)) {
            var notFoundError = new Error('Job with id ' + job_id + ' not found');
            notFoundError.name = 'NotFoundError';
            return callback(notFoundError);
        }

        var jobData = self.toObject(job_id, redisParams, redisValues);

        callback(null, jobData);
    });
};

JobBackend.prototype.create = function (data, callback) {
    var self = this;

    self.get(data.job_id, function (err) {
        if (err && err.name !== 'NotFoundError') {
            return callback(err);
        }

        self.save(data, function (err, job) {
            if (err) {
                return callback(err);
            }

            self.jobQueueProducer.enqueue(data.job_id, data.host, function (err) {
                if (err) {
                    return callback(err);
                }

                // broadcast to consumers
                self.jobPublisher.publish(data.host);

                self.userIndexer.add(data.user, data.job_id, function (err) {
                  if (err) {
                      return callback(err);
                  }

                  callback(null, job);
                });
            });
        });
    });
};

JobBackend.prototype.update = function (data, callback) {
    var self = this;

    self.get(data.job_id, function (err) {
        if (err) {
            return callback(err);
        }

        self.save(data, callback);
    });
};

JobBackend.prototype.save = function (data, callback) {
    var self = this;
    var redisParams = self.toRedisParams(data);

    self.metadataBackend.redisCmd(self.db, 'HMSET', redisParams , function (err) {
        if (err) {
            return callback(err);
        }

        self.setTTL(data, function (err) {
            if (err) {
                return callback(err);
            }

            self.get(data.job_id, function (err, job) {
                if (err) {
                    return callback(err);
                }

                callback(null, job);
            });
        });
    });
};

function isFrozen(status) {
    return finalStatus.indexOf(status) !== -1;
}

JobBackend.prototype.setTTL = function (data, callback) {
    var self = this;
    var redisKey = REDIS_PREFIX + data.job_id;

    if (!isFrozen(data.status)) {
        return callback();
    }

    self.metadataBackend.redisCmd(self.db, 'EXPIRE', [ redisKey, JOBS_TTL_IN_SECONDS ], callback);
};

JobBackend.prototype.list = function (user, callback) {
    var self = this;

    this.userIndexer.list(user, function (err, job_ids) {
        if (err) {
            return callback(err);
        }

        var initialLength = job_ids.length;

        self._getCleanedList(user, job_ids, function (err, jobs) {
            if (err) {
                return callback(err);
            }

            if (jobs.length < initialLength) {
                return self.list(user, callback);
            }

            callback(null, jobs);
        });
    });
};

JobBackend.prototype._getCleanedList = function (user, job_ids, callback) {
    var self = this;

    var jobsQueue = queue(job_ids.length);

    job_ids.forEach(function(job_id) {
        jobsQueue.defer(self._getIndexedJob.bind(self), job_id, user);
    });

    jobsQueue.awaitAll(function (err, jobs) {
        if (err) {
            return callback(err);
        }

        callback(null, jobs.filter(function (job) {
            return job ? true : false;
        }));
    });
};

JobBackend.prototype._getIndexedJob = function (job_id, user, callback) {
    var self = this;

    this.get(job_id, function (err, job) {
        if (err && err.name === 'NotFoundError') {
            return self.userIndexer.remove(user, job_id, function (err) {
                if (err) {
                    console.error('Error removing key %s in user set', job_id, err);
                }
                callback();
            });
        }

        if (err) {
            return callback(err);
        }

        callback(null, job);
    });
};

module.exports = JobBackend;
