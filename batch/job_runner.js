'use strict';

var errorCodes = require('../app/postgresql/error_codes').codeToCondition;
var PSQL = require('cartodb-psql');
var queue = require('queue-async');


function JobRunner(jobBackend, userDatabaseMetadataService) {
    this.jobBackend = jobBackend;
    this.userDatabaseMetadataService = userDatabaseMetadataService;
}

JobRunner.prototype.run = function (job_id, callback) {
    var self = this;

    self.jobBackend.get(job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        if (job.status !== 'pending') {
            var error = new Error('Cannot run job ' + job.job_id + ' due to its status is ' + job.status);
            error.name = 'InvalidJobStatus';
            return callback(error);
        }

        self.userDatabaseMetadataService.getUserMetadata(job.user, function (err, userDatabaseMetadata) {
            if (err) {
                return callback(err);
            }

            self.jobBackend.setRunning(job, function (err, job) {
                if (err) {
                    return callback(err);
                }

                self._runInSeries(job, userDatabaseMetadata, callback);
            });
        });
    });
};

JobRunner.prototype._runInSeries = function(job, userDatabaseMetadata, callback) {
    var self = this;
    var jobQueue = queue(1); // performs in series
    var isMultiQuery = true;

    if (!Array.isArray(job.query)) {
        isMultiQuery = false;
        job.query = [ job.query ];
    }

    for (var i = 0; i < job.query.length; i++) {
        jobQueue.defer(this._run.bind(this), job, userDatabaseMetadata, i, isMultiQuery);
    }

    jobQueue.await(function (err) {
        if (err) {
            // if query has been cancelled then it's going to get the current job status saved by query_canceller
            if (errorCodes[err.code.toString()] === 'query_canceled') {
                return self.jobBackend.get(job.job_id, callback);
            }

            return self.jobBackend.setFailed(job, err, callback);
        }

        self.jobBackend.setDone(job, callback);
    });
};

JobRunner.prototype._run = function (job, userDatabaseMetadata, index, isMultiQuery, callback) {
    this._query(job, userDatabaseMetadata, index, function (err, result) {
        var note = '';

        if (err && isMultiQuery) {
            if (index > 0) {
                note = '; previous queries have finished successfully';
            }

            if (index < (job.query.length - 1)) {
                note += (note ? ' and ' : '; ') + 'later queries were omitted';
            }

            err.message = 'error on query ' + (index + 1) +': ' + err.message + note;

            return callback(err);
        }

        if (err) {
            return callback(err);
        }

        callback(null, result);
    });
};

JobRunner.prototype._query = function (job, userDatabaseMetadata, index, callback) {
    var self = this;

    var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });

    pg.query('SET statement_timeout=0', function (err) {
        if(err) {
            return self.jobBackend.setFailed(job, err, callback);
        }

        // mark query to allow to users cancel their queries
        var sql = '/* ' + job.job_id + ' */ ' + job.query[index];

        pg.eventedQuery(sql, function (err, query) {
            if (err) {
                return self.jobBackend.setFailed(job, err, callback);
            }

            query.on('error', callback);

            query.on('end', function (result) {
                // only if result is present then query is done sucessfully otherwise an error has happened
                // and it was handled by error listener
                if (result) {
                    callback(null, result);
                }
            });
        });
    });
};

module.exports = JobRunner;
