'use strict';

var PSQL = require('cartodb-psql');

function JobCanceller () {
}

module.exports = JobCanceller;

JobCanceller.prototype.cancel = function (job, callback) {
    const dbConfiguration = {
        host: job.data.host,
        port: job.data.port,
        dbname: job.data.dbname,
        user: job.data.dbuser,
        pass: job.data.pass
    };

    doCancel(job.data.job_id, dbConfiguration, callback);
};

function doCancel (jobId, dbConfiguration, callback) {
    var pg = new PSQL(dbConfiguration);

    getQueryPID(pg, jobId, function (err, pid) {
        if (err) {
            return callback(err);
        }

        if (!pid) {
            return callback();
        }

        doCancelQuery(pg, pid, function (err, isCancelled) {
            if (err) {
                return callback(err);
            }

            if (!isCancelled) {
                return callback(new Error('Query has not been cancelled'));
            }

            callback();
        });
    });
}

function getQueryPID (pg, jobId, callback) {
    var getPIDQuery = "SELECT pid FROM pg_stat_activity WHERE query LIKE '/* " + jobId + " */%'";

    pg.query(getPIDQuery, function (err, result) {
        if (err) {
            return callback(err);
        }

        if (!result.rows[0] || !result.rows[0].pid) {
            // query is not running actually, but we have to callback w/o error to cancel the job anyway.
            return callback();
        }

        callback(null, result.rows[0].pid);
    });
}

function doCancelQuery (pg, pid, callback) {
    var cancelQuery = 'SELECT pg_cancel_backend(' + pid + ')';

    pg.query(cancelQuery, function (err, result) {
        if (err) {
            return callback(err);
        }

        var isCancelled = result.rows[0].pg_cancel_backend;

        callback(null, isCancelled);
    });
}
