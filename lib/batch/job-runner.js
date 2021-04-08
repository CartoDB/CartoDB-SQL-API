'use strict';

var errorCodes = require('../postgresql/error-codes').codeToCondition;
var jobStatus = require('./job-status');
var Profiler = require('step-profiler');
var _ = require('underscore');

var REDIS_LIMITS = {
    DB: global.settings.batch_db || 5,
    PREFIX: 'limits:batch:' // + username
};

function JobRunner (jobService, jobQueue, queryRunner, metadataBackend, statsdClient) {
    this.jobService = jobService;
    this.jobQueue = jobQueue;
    this.queryRunner = queryRunner;
    this.metadataBackend = metadataBackend;
    this.statsdClient = statsdClient;
}

JobRunner.prototype.run = function (jobId, callback) {
    var self = this;

    var profiler = new Profiler({ statsd_client: self.statsdClient });
    profiler.start('sqlapi.batch.job');

    self.jobService.get(jobId, function (err, job) {
        if (err) {
            return callback(err);
        }

        self.getQueryStatementTimeout(job.data.user, function (err, timeout) {
            if (err) {
                return callback(err);
            }

            var query = job.getNextQuery();

            if (_.isObject(query)) {
                if (Number.isFinite(query.timeout) && query.timeout > 0) {
                    timeout = Math.min(timeout, query.timeout);
                }
                query = query.query;
            }

            try {
                job.setStatus(jobStatus.RUNNING);
            } catch (err) {
                return callback(err);
            }

            self.jobService.save(job, function (err, job) {
                if (err) {
                    return callback(err);
                }

                profiler.done('running');

                self._run(job, query, timeout, profiler, callback);
            });
        });
    });
};

JobRunner.prototype.getQueryStatementTimeout = function (username, callback) {
    var timeout = 12 * 3600 * 1000;
    if (Number.isFinite(global.settings.batch_query_timeout)) {
        timeout = global.settings.batch_query_timeout;
    }

    var batchLimitsKey = REDIS_LIMITS.PREFIX + username;
    this.metadataBackend.redisCmd(REDIS_LIMITS.DB, 'HGET', [batchLimitsKey, 'timeout'], function (err, timeoutLimit) {
        if (err) {
            return callback(err);
        }

        if (timeoutLimit !== null && Number.isFinite(+timeoutLimit)) {
            timeout = +timeoutLimit;
        }

        return callback(null, timeout);
    });
};

JobRunner.prototype._run = function (job, query, timeout, profiler, callback) {
    var self = this;

    const dbparams = {
        pass: job.data.pass,
        user: job.data.dbuser,
        dbname: job.data.dbname,
        port: job.data.port,
        host: job.data.host
    };

    self.queryRunner.run(job.data.job_id, query, job.data.user, timeout, dbparams, function (err /*, result */) {
        if (err) {
            if (!err.code) {
                return callback(err);
            }
            // if query has been cancelled then it's going to get the current
            // job status saved by query_canceller
            if (cancelledByUser(err)) {
                return self.jobService.get(job.data.job_id, callback);
            }
        }

        try {
            if (err) {
                profiler.done('failed');
                job.setStatus(jobStatus.FAILED, err.message);
            } else {
                profiler.done('success');
                job.setStatus(jobStatus.DONE);
            }
        } catch (err) {
            return callback(err);
        }

        self.jobService.save(job, function (err, job) {
            if (err) {
                return callback(err);
            }

            profiler.done('done');
            profiler.end();
            profiler.sendStats();

            if (!job.hasNextQuery()) {
                return callback(null, job);
            }

            self.jobQueue.enqueueFirst(job.data.user, job.data.job_id, function (err) {
                if (err) {
                    return callback(err);
                }

                callback(null, job);
            });
        });
    });
};

function cancelledByUser (err) {
    return errorCodes[err.code.toString()] === 'query_canceled' && err.message.match(/user.*request/);
}

module.exports = JobRunner;
