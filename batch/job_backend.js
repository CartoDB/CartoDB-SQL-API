'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var uuid = require('node-uuid');
var queue = require('queue-async');
var JOBS_TTL_AFTER_RESOLUTION = 48 * 3600;

function JobBackend(metadataBackend, jobQueueProducer, jobPublisher, userIndexer) {
    EventEmitter.call(this);
    this.metadataBackend = metadataBackend;
    this.jobQueueProducer = jobQueueProducer;
    this.jobPublisher = jobPublisher;
    this.userIndexer = userIndexer;
    this.db = 5;
    this.redisPrefix = 'batch:jobs:';
}
util.inherits(JobBackend, EventEmitter);

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
            return callback(new Error('Job is not pending, it couldn\'t be updated'));
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

JobBackend.prototype.get = function (job_id, callback) {
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

        function isJobFound(jobValues) {
            return jobValues[0] && jobValues[1] && jobValues[2] && jobValues[3] && jobValues[4];
        }

        if (!isJobFound(jobValues)) {
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
            failed_reason: jobValues[5] ? jobValues[5] : undefined
        });
    });
};

JobBackend.prototype.setRunning = function (job) {
    var self = this;
    var redisParams = [
        this.redisPrefix + job.job_id,
        'status', 'running',
        'updated_at', new Date().toISOString()
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams, function (err) {
        if (err) {
            return self.emit('error', err);
        }

        self.emit('running', job);
    });
};

JobBackend.prototype.setDone = function (job) {
    var self = this;
    var redisKey = this.redisPrefix + job.job_id;
    var redisParams = [
        redisKey,
        'status', 'done',
        'updated_at', new Date().toISOString()
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams ,  function (err) {
        if (err) {
            return self.emit('error', err);
        }

        self.metadataBackend.redisCmd(self.db, 'EXPIRE', [ redisKey, JOBS_TTL_AFTER_RESOLUTION ], function (err) {
            if (err) {
                return self.emit('error', err);
            }

            self.emit('done', job);
        });
    });
};

JobBackend.prototype.setFailed = function (job, err) {
    var self = this;
    var redisKey = this.redisPrefix + job.job_id;
    var redisParams = [
        redisKey,
        'status', 'failed',
        'failed_reason', err.message,
        'updated_at', new Date().toISOString()
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams , function (err) {
        if (err) {
            return self.emit('error', err);
        }

        self.metadataBackend.redisCmd(self.db, 'EXPIRE', [ redisKey, JOBS_TTL_AFTER_RESOLUTION ], function (err) {
            if (err) {
                return self.emit('error', err);
            }

            self.emit('failed', job);
        });
    });
};

JobBackend.prototype.setCancelled = function (job) {
    var self = this;
    var redisKey = this.redisPrefix + job.job_id;
    var redisParams = [
        redisKey,
        'status', 'cancelled',
        'updated_at', new Date().toISOString()
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams ,  function (err) {
        if (err) {
            return self.emit('error', err);
        }

        self.metadataBackend.redisCmd(self.db, 'EXPIRE', [ redisKey, JOBS_TTL_AFTER_RESOLUTION ], function (err) {
            if (err) {
                return self.emit('error', err);
            }

            self.emit('cancelled', job);
        });

    });
};


module.exports = JobBackend;
