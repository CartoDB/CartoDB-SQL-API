'use strict';

var uuid = require('node-uuid');
var queue = require('queue-async');
var moment = require('moment');
require("moment-duration-format");
var JOBS_TTL_IN_SECONDS = global.settings.jobs_ttl_in_seconds || 48 * 3600; // 48 hours

function getDuration(start, end) {
    var startDate = moment(start);
    var endDate = moment(end);
    return moment.duration(endDate.diff(startDate, 'seconds', true), 'seconds').format('d[d] h[h]:mm[m]:ss[s]');
}

function JobBackend(metadataBackend, jobQueueProducer, jobPublisher, userIndexer) {
    this.db = 5;
    this.redisPrefix = 'batch:jobs:';
    this.metadataBackend = metadataBackend;
    this.jobQueueProducer = jobQueueProducer;
    this.jobPublisher = jobPublisher;
    this.userIndexer = userIndexer;
}

JobBackend.prototype.create = function (username, sql, host, callback) {
    var self = this;
    var job_id = uuid.v4();
    var now = new Date().toISOString();
    var redisParams = [
        this.redisPrefix + job_id,
        'user', username,
        'status', 'pending',
        'query', sql,
        'created_at', now,
        'updated_at', now
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams , function (err) {
        if (err) {
            return callback(err);
        }

        self.jobQueueProducer.enqueue(job_id, host, function (err) {
            if (err) {
                return callback(err);
            }

            // broadcast to consumers
            self.jobPublisher.publish(host);

            self.userIndexer.add(username, job_id, function (err) {
              if (err) {
                  return callback(err);
              }

              self.get(job_id, callback);
            });
        });
    });
};

JobBackend.prototype.update = function (job_id, sql, callback) {
    var self = this;

    this.get(job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        if (job.status !== 'pending') {
            return callback(new Error('Job is not pending, it cannot be updated'));
        }

        var now = new Date().toISOString();
        var redisParams = [
            self.redisPrefix + job_id,
            'query', sql,
            'updated_at', now
        ];

        self.metadataBackend.redisCmd(self.db, 'HMSET', redisParams , function (err) {
            if (err) {
                return callback(err);
            }

            self.get(job_id, callback);
        });

    });
};

JobBackend.prototype.list = function (username, callback) {
    var self = this;

    this.userIndexer.list(username, function (err, job_ids) {
        if (err) {
            return callback(err);
        }

        var initialLength = job_ids.length;

        self._getCleanedList(username, job_ids, function (err, jobs) {
            if (err) {
                return callback(err);
            }

            if (jobs.length < initialLength) {
                return self.list(username, callback);
            }

            callback(null, jobs);
        });
    });
};

JobBackend.prototype._getCleanedList = function (username, job_ids, callback) {
    var self = this;

    var jobsQueue = queue(job_ids.length);

    job_ids.forEach(function(job_id) {
        jobsQueue.defer(self._getIndexedJob.bind(self), job_id, username);
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

JobBackend.prototype._getIndexedJob = function (job_id, username, callback) {
    var self = this;

    this.get(job_id, function (err, job) {

        if (err && err.name === 'NotFoundError') {
            return self.userIndexer.remove(username, job_id, function (err) {
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

JobBackend.prototype._isJobFound = function (jobValues) {
    return jobValues[0] && jobValues[1] && jobValues[2] && jobValues[3] && jobValues[4];
};

// jshint maxcomplexity: 7
JobBackend.prototype.get = function (job_id, callback) {
    var self = this;
    var redisParams = [
        this.redisPrefix + job_id,
        'user',
        'status',
        'query',
        'created_at',
        'updated_at',
        'failed_reason',
        'waiting_elapsed_time',
        'running_elapsed_time',
        'total_elapsed_time'
    ];

    this.metadataBackend.redisCmd(this.db, 'HMGET', redisParams , function (err, jobValues) {
        if (err) {
            return callback(err);
        }

        if (!self._isJobFound(jobValues)) {
            var notFoundError = new Error('Job with id ' + job_id + ' not found');
            notFoundError.name = 'NotFoundError';
            return callback(notFoundError);
        }

        callback(null, {
            job_id: job_id,
            user: jobValues[0],
            status: jobValues[1],
            query: jobValues[2],
            created_at: jobValues[3],
            updated_at: jobValues[4],
            failed_reason: jobValues[5] ? jobValues[5] : undefined,
            waiting_elapsed_time: jobValues[6] ? jobValues[6] : undefined,
            running_elapsed_time: jobValues[7] ? jobValues[7] : undefined,
            total_elapsed_time: jobValues[8] ? jobValues[8] : undefined
        });
    });
};

JobBackend.prototype.setRunning = function (job, callback) {
    var self = this;
    var now = new Date().toISOString();
    var redisParams = [
        this.redisPrefix + job.job_id,
        'status', 'running',
        'updated_at', now,
        'waiting_elapsed_time', getDuration(job.created_at, now)
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams, function (err) {
        if (err) {
            return callback(err);
        }

        self.get(job.job_id, callback);
    });
};

JobBackend.prototype.setPending = function (job, callback) {
    var self = this;
    var now = new Date().toISOString();
    var redisKey = this.redisPrefix + job.job_id;
    var redisParams = [
        redisKey,
        'status', 'pending',
        'updated_at', now
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams ,  function (err) {
        if (err) {
            return callback(err);
        }

        self.get(job.job_id, callback);
    });
};

JobBackend.prototype.setDone = function (job, callback) {
    var self = this;
    var now = new Date().toISOString();
    var redisKey = this.redisPrefix + job.job_id;
    var redisParams = [
        redisKey,
        'status', 'done',
        'updated_at', now,
        'running_elapsed_time', getDuration(job.updated_at, now),
        'total_elapsed_time', getDuration(job.created_at, now)
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams ,  function (err) {
        if (err) {
            return callback(err);
        }

        self.metadataBackend.redisCmd(self.db, 'EXPIRE', [ redisKey, JOBS_TTL_IN_SECONDS ], function (err) {
            if (err) {
                return callback(err);
            }

            self.get(job.job_id, callback);
        });
    });
};

JobBackend.prototype.setFailed = function (job, error, callback) {
    var self = this;
    var now = new Date().toISOString();
    var redisKey = this.redisPrefix + job.job_id;
    var redisParams = [
        redisKey,
        'status', 'failed',
        'failed_reason', error.message,
        'updated_at', now,
        'running_elapsed_time', getDuration(job.updated_at, now),
        'total_elapsed_time', getDuration(job.created_at, now)
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams , function (err) {
        if (err) {
            return callback(err);
        }

        self.metadataBackend.redisCmd(self.db, 'EXPIRE', [ redisKey, JOBS_TTL_IN_SECONDS ], function (err) {
            if (err) {
                return callback(err);
            }

            self.get(job.job_id, callback);
        });
    });
};

JobBackend.prototype.setCancelled = function (job, callback) {
    var self = this;
    var now = new Date().toISOString();
    var redisKey = this.redisPrefix + job.job_id;
    var durationKey = job.status === 'pending' ? 'waiting_elapsed_time' : 'running_elapsed_time';
    var durationValue = job.status === 'pending' ? getDuration(job.created_at, now) : getDuration(job.updated_at, now);
    var redisParams = [
        redisKey,
        'status', 'cancelled',
        'updated_at', now,
        durationKey, durationValue,
        'total_elapsed_time', getDuration(job.created_at, now)
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams ,  function (err) {
        if (err) {
            return callback(err);
        }

        self.metadataBackend.redisCmd(self.db, 'PERSIST', [ redisKey ], function (err) {
            if (err) {
                return callback(err);
            }

            self.get(job.job_id, callback);
        });

    });
};

JobBackend.prototype.setUnknown = function (job_id, callback) {
    var self = this;

    this.get(job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        var now = new Date().toISOString();
        var redisKey = self.redisPrefix + job.job_id;
        var redisParams = [
            redisKey,
            'status', 'unknown',
            'updated_at', now,
            'running_elapsed_time', getDuration(job.updated_at, now),
            'total_elapsed_time', getDuration(job.created_at, now)
        ];

        self.metadataBackend.redisCmd(self.db, 'HMSET', redisParams ,  function (err) {
            if (err) {
                return callback(err);
            }

            self.metadataBackend.redisCmd(self.db, 'EXPIRE', [ redisKey, JOBS_TTL_IN_SECONDS ], function (err) {
                if (err) {
                    return callback(err);
                }

                self.get(job.job_id, callback);
            });
        });
    });
};


module.exports = JobBackend;
