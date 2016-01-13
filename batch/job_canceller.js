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
            return callback(new Error('Job is ' + job.status + ', cancel is not allowed'));
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
        if (err) {
            return callback(err);
        }

        self.jobBackend.setPending(job, callback);
    });

};

JobCanceller.prototype._query = function (job, userDatabaseMetadata, callback) {
    var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });
    var getPIDQuery = 'SELECT pid FROM pg_stat_activity WHERE query = \'' + job.query +
        ' /* ' + job.job_id + ' */\'';

    pg.query(getPIDQuery, function(err, result) {
        if(err) {
            return callback(err);
        }

        if (!result.rows[0] || !result.rows[0].pid) {
            return callback(new Error('Query not running currently'));
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
