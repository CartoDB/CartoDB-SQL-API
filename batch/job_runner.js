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

                self._series(job, userDatabaseMetadata, callback);
            });
        });
    });
};

JobRunner.prototype._series = function(job, userDatabaseMetadata, callback) {
    var self = this;
    var jobQueue = queue(1); // performs in series

    if (!Array.isArray(job.query)) {
        job.query = [ job.query ];
    }

    for (var i = 0; i < job.query.length; i++) {
        jobQueue.defer(this._query.bind(this), job, userDatabaseMetadata, i);
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

JobRunner.prototype._query = function (job, userDatabaseMetadata, index, callback) {
    var self = this;

    var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });

    pg.query('SET statement_timeout=0', function (err) {
        if(err) {
            return self.jobBackend.setFailed(job, err, callback);
        }

        // mark query to allow to users cancel their queries whether users request for it
        var sql = '/* ' + job.job_id + ' */ ' + job.query[index];

        pg.eventedQuery(sql, function (err, query) {
            if (err) {
                return self.jobBackend.setFailed(job, err, callback);
            }

            query.on('error', function (err) {
                err.message = 'Error on query[' + index +']: ' + err.message;
                callback(err);
            });

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
