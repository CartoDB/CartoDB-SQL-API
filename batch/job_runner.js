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
            return callback(new Error('Cannot run job ' + job.job_id + ' due to its status is ' + job.status));
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
                if (err.code === QUERY_CANCELED) {
                    return self.jobBackend.setCancelled(job, callback);
                }

                self.jobBackend.setFailed(job, err, callback);
            });

            query.on('end', function (result) {
                if (result) {
                    self.jobBackend.setDone(job, callback);
                }
            });
        });
    });
};

module.exports = JobRunner;
