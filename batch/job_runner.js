'use strict';

var PSQL = require('cartodb-psql');
var QUERY_CANCELED = '57014';

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

                self._query(job, userDatabaseMetadata, callback);
            });
        });
    });
};

JobRunner.prototype._query = function (job, userDatabaseMetadata, callback) {
    var self = this;

    var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });

    pg.query('SET statement_timeout=0', function (err) {
        if(err) {
            return self.jobBackend.setFailed(job, err, callback);
        }

        // mark query to allow to users cancel their queries whether users request for it
        var sql = job.query + ' /* ' + job.job_id + ' */';

        pg.eventedQuery(sql, function (err, query) {
            if (err) {
                return self.jobBackend.setFailed(job, err, callback);
            }

            query.on('error', function (err) {
                // if query has been cancelled then it's going to get the current job status saved by query_canceller
                if (err.code === QUERY_CANCELED) {
                    return self.jobBackend.get(job.job_id, callback);
                }

                self.jobBackend.setFailed(job, err, callback);
            });

            query.on('end', function (result) {
                // only if result is present then query is done sucessfully otherwise an error has happened
                // and it was handled by error listener
                if (result) {
                    return self.jobBackend.setDone(job, callback);
                }
            });
        });
    });
};

module.exports = JobRunner;
