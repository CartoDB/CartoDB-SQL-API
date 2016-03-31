'use strict';

var errorCodes = require('../app/postgresql/error_codes').codeToCondition;

function getNextQuery(job) {
    if (!Array.isArray(job.query)) {
        return {
            query: job.query
        };
    }

    for (var i = 0; i < job.query.length; i++) {
        if (job.query[i].status === 'pending') {
            return {
                index: i,
                query: job.query[i].query
            };
        }
    }
}

function isLastQuery(job, index) {
    if (!Array.isArray(job.query)) {
        return true;
    }

    if (index >= (job.query.length -1)) {
        return true;
    }

    return false;
}

function JobRunner(jobBackend, jobQueue, queryRunner,userDatabaseMetadataService) {
    this.jobBackend = jobBackend;
    this.jobQueue = jobQueue;
    this.queryRunner = queryRunner;
    this.userDatabaseMetadataService = userDatabaseMetadataService;
}

JobRunner.prototype.run = function (job_id, callback) {
    var self = this;

    self.jobBackend.get(job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        if (job.status !== 'pending') {
            var invalidJobStatusError = new Error([
                'Cannot run job',
                job.job_id,
                'due to its status is',
                job.status
            ].join(' '));
            invalidJobStatusError.name = 'InvalidJobStatus';
            return callback(invalidJobStatusError);
        }

        var query = getNextQuery(job);

        if (!query) {
            var queryNotFoundError = new Error([
                'Cannot run job',
                job.job_id,
                ', there is no query to run'
            ].join(' '));
            queryNotFoundError.name = 'QueryNotFound';
            return callback(queryNotFoundError);
        }

        self.jobBackend.setRunning(job, query.index, function (err, job) {
            if (err) {
                return callback(err);
            }

            self._run(job, query, callback);
        });
    });
};

JobRunner.prototype._run = function (job, query, callback) {
    var self = this;
    self.userDatabaseMetadataService.getUserMetadata(job.user, function (err, userDatabaseMetadata) {
        if (err) {
            return callback(err);
        }

        self.queryRunner.run(job.job_id, query.query, userDatabaseMetadata, function (err /*, result */) {
            if (err) {
                // if query has been cancelled then it's going to get the current
                // job status saved by query_canceller
                if (errorCodes[err.code.toString()] === 'query_canceled') {
                    return self.jobBackend.get(job.job_id, callback);
                }

                return self.jobBackend.setFailed(job, err, query.index, callback);
            }

            if (isLastQuery(job, query.index)) {
                console.log('set done', query.index);
                return self.jobBackend.setDone(job, query.index, callback);
            }

            self.jobBackend.setJobPendingAndQueryDone(job, query.index, function (err, job) {
                if (err) {
                    return callback(err);
                }

                self.jobQueue.enqueue(job.job_id, userDatabaseMetadata.host, function (err){
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
