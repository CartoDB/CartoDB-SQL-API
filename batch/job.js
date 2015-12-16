'use strict';

var PSQL = require('cartodb-psql');

function Job() {
}

Job.prototype.run = function (userDatabaseMetada, callback) {
    var self = this;

    var pg = new PSQL(userDatabaseMetada, {}, { destroyOnError: true });

    this.getJob(pg, function (err, job) {
        if (err) {
            return callback(err);
        }

        if (!job) {
            return callback();
        }

        self.setJobRunning(pg, job, function (err) {
            if (err) {
                return callback(err);
            }

            self.runJob(pg, job, function (err, jobResult) {
                if (err) {
                    return self.setJobFailed(pg, job, err.message, function () {
                        callback(err);
                    });
                }

                self.setJobDone(pg, job, function () {
                    callback(null, jobResult);
                });
            });
        });
    });
};

Job.prototype.getJob = function (pg, callback) {
    var getNextJob = "SELECT * FROM cdb_jobs WHERE status='pending' ORDER BY updated_at ASC LIMIT 1";

    pg.query(getNextJob, function (err, result) {
        if (err) {
            return callback(err);
        }

        callback(null, result.rows[0]);
    });
};

Job.prototype.runJob = function (pg, job, callback) {
    var query = job.query;

    if (job.query.match(/SELECT\s.*FROM\s.*/i)) {
        query = 'SELECT * INTO "job_' + job.job_id + '" FROM (' + job.query + ') AS j';
    }

    pg.query(query, callback);
};

Job.prototype.setJobRunning = function (pg, job, callback) {
    var runningJobQuery = [
        'UPDATE cdb_jobs SET ',
            'status = \'running\', ',
            'updated_at = now() ',
        ' WHERE ',
            'job_id = \'' + job.job_id + '\' ',
        ' RETURNING job_id;'
    ].join('\n');

    pg.query(runningJobQuery, callback);
};

Job.prototype.setJobDone = function (pg, job, callback) {
    var doneJobQuery = [
        'UPDATE cdb_jobs SET ',
            'status = \'done\', ',
            'updated_at = now() ',
        ' WHERE ',
            'job_id = \'' + job.job_id + '\' ',
        ' RETURNING job_id;'
    ].join('\n');

    pg.query(doneJobQuery, function (err) {
        if (err) {
            console.error(err.stack);
        }
        callback();
    });
};

Job.prototype.setJobFailed = function (pg, job, message, callback) {
    var failedJobQuery = [
        'UPDATE cdb_jobs SET ',
            'status = \'failed\', ',
            'failed_reason = \'' + message + '\', ',
            'updated_at = now() ',
        ' WHERE ',
            'job_id = \'' + job.job_id + '\' ',
        ' RETURNING job_id;'
    ].join('\n');

    pg.query(failedJobQuery, function (err) {
        if (err) {
            console.error(err.stack);
        }
        callback();
    });
};

module.exports = Job;
