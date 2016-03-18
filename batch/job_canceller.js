'use strict';

var PSQL = require('cartodb-psql');

function JobCanceller(metadataBackend, userDatabaseMetadataService, jobBackend) {
    this.metadataBackend = metadataBackend;
    this.userDatabaseMetadataService = userDatabaseMetadataService;
    this.jobBackend = jobBackend;
}

JobCanceller.prototype.cancel = function (job_id, callback) {
    var self = this;

    self.jobBackend.get(job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        if (job.status === 'pending') {
            return self.jobBackend.setCancelled(job, callback);
        }

        if (job.status !== 'running') {
            var cancelNotAllowedError = new Error('Job is ' + job.status + ', cancel is not allowed');
            cancelNotAllowedError.name  = 'CancelNotAllowedError';
            return callback(cancelNotAllowedError);
        }

        self.userDatabaseMetadataService.getUserMetadata(job.user, function (err, userDatabaseMetadata) {
            if (err) {
                return callback(err);
            }

            self._query(job, userDatabaseMetadata, function (err, job) {
                if (err) {
                    return callback(err);
                }

                self.jobBackend.setCancelled(job, callback);
            });
        });
    });
};

JobCanceller.prototype.drain = function (job_id, callback) {
    var self = this;

    this.cancel(job_id, function (err, job) {
        if (err && err.name === 'CancelNotAllowedError') {
            return callback(err);
        }

        if (err) {
            console.error('There was an error while draining job %s, %s ',  job_id, err);
            return self.jobBackend.setUnknown(job_id, callback);
        }

        self.jobBackend.setPending(job, callback);
    });

};

JobCanceller.prototype._query = function (job, userDatabaseMetadata, callback) {
    var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });
    var getPIDQuery = "SELECT pid FROM pg_stat_activity WHERE query LIKE '/* " + job.job_id + " */%'";

    pg.query(getPIDQuery, function(err, result) {
        if (err) {
            return callback(err);
        }

        if (!result.rows[0] || !result.rows[0].pid) {
            return callback(new Error('Query is not running currently'));
        }

        var pid = result.rows[0].pid;
        var cancelQuery = 'SELECT pg_cancel_backend(' + pid + ')';

        pg.query(cancelQuery, function (err, result) {
            if (err) {
                return callback(err);
            }

            var isCancelled = result.rows[0].pg_cancel_backend;

            if (!isCancelled) {
                return callback(new Error('Query has not been cancelled'));
            }

            callback(null, job);
        });
    });
};


module.exports = JobCanceller;
