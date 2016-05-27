'use strict';

var errorCodes = require('../app/postgresql/error_codes').codeToCondition;
var jobStatus = require('./job_status');
var Profiler = require('step-profiler');

function JobRunner(jobService, jobQueue, queryRunner, userDatabaseMetadataService, statsdClient) {
    this.jobService = jobService;
    this.jobQueue = jobQueue;
    this.queryRunner = queryRunner;
    this.userDatabaseMetadataService = userDatabaseMetadataService; // TODO: move to queryRunner
    this.statsdClient = statsdClient;
}

JobRunner.prototype.run = function (job_id, callback) {
    var self = this;

    self.profiler = new Profiler({ statsd_client: self.statsdClient });
    self.profiler.start('sqlapi.batch.' + job_id);

    self.jobService.get(job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        var query = job.getNextQuery();

        try {
            job.setStatus(jobStatus.RUNNING);
        } catch (err) {
            return callback(err);
        }

        self.jobService.save(job, function (err, job) {
            if (err) {
                return callback(err);
            }

            self.profiler.done('running');

            self._run(job, query, callback);
        });
    });
};

JobRunner.prototype._run = function (job, query, callback) {
    var self = this;

    // TODO: move to query
    self.userDatabaseMetadataService.getUserMetadata(job.data.user, function (err, userDatabaseMetadata) {
        if (err) {
            return callback(err);
        }

        self.queryRunner.run(job.data.job_id, query, userDatabaseMetadata, function (err /*, result */) {
            if (err) {
                // if query has been cancelled then it's going to get the current
                // job status saved by query_canceller
                if (errorCodes[err.code.toString()] === 'query_canceled') {
                    return self.jobService.get(job.data.job_id, callback);
                }
            }

            try {
                if (err) {
                    self.profiler.done('failed');
                    job.setStatus(jobStatus.FAILED, err.message);
                } else {
                    self.profiler.done('success');
                    job.setStatus(jobStatus.DONE);
                }
            } catch (err) {
                return callback(err);
            }

            self.jobService.save(job, function (err, job) {
                if (err) {
                    return callback(err);
                }

                self.profiler.done('done');
                self.profiler.end();
                self.profiler.sendStats();

                if (!job.hasNextQuery()) {
                    return callback(null, job);
                }

                self.jobQueue.enqueue(job.data.job_id, userDatabaseMetadata.host, function (err) {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, job);
                });
            });
        });
    });
};

module.exports = JobRunner;
