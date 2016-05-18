'use strict';

var PSQL = require('cartodb-psql');

function JobCanceller(userDatabaseMetadataService) {
    this.userDatabaseMetadataService = userDatabaseMetadataService;
}

module.exports = JobCanceller;

JobCanceller.prototype.cancel = function (job, callback) {
    this.userDatabaseMetadataService.getUserMetadata(job.data.user, function (err, userDatabaseMetadata) {
        if (err) {
            return callback(err);
        }

        doCancel(job.data.job_id, userDatabaseMetadata, callback);
    });
};

function doCancel(job_id, userDatabaseMetadata, callback) {
    var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });

    getQueryPID(pg, job_id, function (err, pid) {
        if (err) {
            return callback(err);
        }

        doCancelQuery(pg, pid, function (err, isCancelled) {
            if (err) {
                return callback(err);
            }

            if (!isCancelled) {
                return callback(new Error('Query has not been cancelled'));
            }

            callback(null);
        });
    });
}

function getQueryPID(pg, job_id, callback) {
    var getPIDQuery = "SELECT pid FROM pg_stat_activity WHERE query LIKE '/* " + job_id + " */%'";

    pg.query(getPIDQuery, function(err, result) {
        if (err) {
            return callback(err);
        }

        if (!result.rows[0] || !result.rows[0].pid) {
            return callback(new Error('Query is not running currently'));
        }

        callback(null, result.rows[0].pid);
    });
}

function doCancelQuery(pg, pid, callback) {
    var cancelQuery = 'SELECT pg_cancel_backend(' + pid + ')';

    pg.query(cancelQuery, function (err, result) {
        if (err) {
            return callback(err);
        }

        var isCancelled = result.rows[0].pg_cancel_backend;

        callback(null, isCancelled);
    });
}
