'use strict';

var errorCodes = require('../app/postgresql/error_codes').codeToCondition;
var jobStatus = require('./job_status');
var Profiler = require('step-profiler');
var _ = require('underscore');

function JobRunner(jobService, jobQueue, queryRunner, statsdClient) {
    this.jobService = jobService;
    this.jobQueue = jobQueue;
    this.queryRunner = queryRunner;
    this.statsdClient = statsdClient;
}

JobRunner.prototype.run = function (job_id, callback) {
    var self = this;

    var profiler = new Profiler({ statsd_client: self.statsdClient });
    profiler.start('sqlapi.batch.job');

    self.jobService.get(job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        var query = job.getNextQuery();
        var timeout = 12 * 3600 * 1000;
        if (Number.isFinite(global.settings.batch_query_timeout)) {
            timeout = global.settings.batch_query_timeout;
        }
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
};

JobRunner.prototype._run = function (job, query, timeout, profiler, callback) {
    var self = this;

    self.queryRunner.run(job.data.job_id, query, job.data.user, timeout, function (err /*, result */) {
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

            self.jobQueue.enqueueFirst(job.data.job_id, job.data.host, function (err) {
                if (err) {
                    return callback(err);
                }

                callback(null, job);
            });
        });
    });
};

function cancelledByUser(err) {
    return errorCodes[err.code.toString()] === 'query_canceled' && err.message.match(/user.*request/);
}

module.exports = JobRunner;
