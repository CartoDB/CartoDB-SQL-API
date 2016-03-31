'use strict';

var uuid = require('node-uuid');
var queue = require('queue-async');
var JOBS_TTL_IN_SECONDS = global.settings.jobs_ttl_in_seconds || 48 * 3600; // 48 hours

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

    if (Array.isArray(sql)) {
        for (var i = 0; i < sql.length; i++) {
            sql[i] = {
                query: sql[i],
                status: 'pending'
            };
        }
    }

    var redisParams = [
        this.redisPrefix + job_id,
        'user', username,
        'status', 'pending',
        'query', JSON.stringify(sql),
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
            'query', JSON.stringify(sql),
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

JobBackend.prototype.get = function (job_id, callback) {
    var self = this;
    var redisParams = [
        this.redisPrefix + job_id,
        'user',
        'status',
        'query',
        'created_at',
        'updated_at',
        'failed_reason'
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

        var query;

        try {
            query = JSON.parse(jobValues[2]);
        } catch (err) {
            query = jobValues[2];
        }

        callback(null, {
            job_id: job_id,
            user: jobValues[0],
            status: jobValues[1],
            query: query,
            created_at: jobValues[3],
            updated_at: jobValues[4],
            failed_reason: jobValues[5] ? jobValues[5] : undefined
        });
    });
};

JobBackend.prototype.setRunning = function (job, index, callback) {
    var self = this;
    var now = new Date().toISOString();
    var redisParams = [
        this.redisPrefix + job.job_id,
        'status', 'running',
        'updated_at', now,
    ];

    if (!callback) {
        callback = index;
    } else if (index || index === 0) {
        job.query[index].status = 'running';
        redisParams = redisParams.concat('query', JSON.stringify(job.query));
    }

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams, function (err) {
        if (err) {
            return callback(err);
        }

        self.get(job.job_id, callback);
    });
};

JobBackend.prototype.setPending = function (job, index, callback) {
    var self = this;
    var now = new Date().toISOString();
    var redisKey = this.redisPrefix + job.job_id;
    var redisParams = [
        redisKey,
        'status', 'pending',
        'updated_at', now
    ];

    if (!callback) {
        callback = index;
    } else if (index || index === 0) {
        job.query[index].status = 'pending';
        redisParams = redisParams.concat('query', JSON.stringify(job.query));
    }

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams ,  function (err) {
        if (err) {
            return callback(err);
        }

        self.get(job.job_id, callback);
    });
};

JobBackend.prototype.setDone = function (job, index, callback) {
    var self = this;
    var now = new Date().toISOString();
    var redisKey = this.redisPrefix + job.job_id;
    var redisParams = [
        redisKey,
        'status', 'done',
        'updated_at', now
    ];

    if (!callback) {
        callback = index;
    } else if (index || index === 0) {
        job.query[index].status = 'done';
        redisParams = redisParams.concat('query', JSON.stringify(job.query));
    }

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

JobBackend.prototype.setJobPendingAndQueryDone = function (job, index, callback) {
    var self = this;
    var now = new Date().toISOString();
    var redisKey = this.redisPrefix + job.job_id;

    job.query[index].status = 'done';

    var redisParams = [
        redisKey,
        'status', 'pending',
        'updated_at', now,
        'query', JSON.stringify(job.query)
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams ,  function (err) {
        if (err) {
            return callback(err);
        }

        self.get(job.job_id, callback);
    });
};

JobBackend.prototype.setFailed = function (job, error, index, callback) {
    var self = this;
    var now = new Date().toISOString();
    var redisKey = this.redisPrefix + job.job_id;
    var redisParams = [
        redisKey,
        'status', 'failed',
        'failed_reason', error.message,
        'updated_at', now
    ];

    if (!callback) {
        callback = index;
    } else if (index || index === 0) {
        job.query[index].status = 'failed';
        job.query[index].failed_reason = error.message;
        redisParams = redisParams.concat('query', JSON.stringify(job.query));
    }

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

JobBackend.prototype.setCancelled = function (job, index, callback) {
    var self = this;
    var now = new Date().toISOString();
    var redisKey = this.redisPrefix + job.job_id;
    var redisParams = [
        redisKey,
        'status', 'cancelled',
        'updated_at', now
    ];

    if (!callback) {
        callback = index;
    } else if (index || index === 0) {
        job.query[index].status = 'cancelled';
        redisParams = redisParams.concat('query', JSON.stringify(job.query));
    }

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
            'updated_at', now
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
