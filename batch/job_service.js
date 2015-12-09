'use strict';

var PSQL = require('cartodb-psql');

function JobService() {
}

JobService.prototype.run = function (userDatabaseMetada, callback) {
    var self = this;

    var pg = new PSQL(userDatabaseMetada, {}, { destroyOnError: true });

    this.getJob(pg, function (err, job) {
        if (err) {
            return callback(err);
        }

        self.setJobRunning(pg, job, function (err) {
            if (err) {
                return callback(err);
            }

            self.runJob(pg, job, function (err, jobResult) {
                if (err) {
                    self.setJobFailed(pg, job, err.message, function (err) {
                        if (err) {
                            return callback(err);
                        }
                        callback(null, jobResult);
                    });
                } else {
                    self.setJobDone(pg, job, function (err) {
                        if (err) {
                            return callback(err);
                        }
                        console.info('Job %s done successfully', job.job_id);
                        callback(null, jobResult);
                    });
                }
            });
        });
    });
};

JobService.prototype.runJob = function (pg, job, callback) {
    var query = job.query;

    if (job.query.match(/SELECT\s.*FROM\s.*/i)) {
        query = 'SELECT * INTO job_' + job.job_id.replace(/-/g, '_') + ' FROM (' + job.query + ') as q';
    }

    pg.query(query, function (err, jobResult) {
        if (err) {
            return callback(err);
        }
        callback(null, jobResult);
    });
};

JobService.prototype.setJobRunning = function (pg, job, callback) {
    var runningJobQuery = [
        'UPDATE cdb_jobs SET ',
            'status = \'running\', ',
            'updated_at = now() ',
        ' WHERE ',
            'job_id = \'' + job.job_id + '\' ',
        ' RETURNING job_id;'
    ].join('\n');

    pg.query(runningJobQuery, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, result);
    });
};

JobService.prototype.setJobDone = function (pg, job, callback) {
    var doneJobQuery = [
        'UPDATE cdb_jobs SET ',
            'status = \'done\', ',
            'updated_at = now() ',
        ' WHERE ',
            'job_id = \'' + job.job_id + '\' ',
        ' RETURNING job_id;'
    ].join('\n');

    pg.query(doneJobQuery, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, result);
    });
};

JobService.prototype.setJobFailed = function (pg, job, message, callback) {
    var failedJobQuery = [
        'UPDATE cdb_jobs SET ',
            'status = \'failed\', ',
            'failed_reason = \'' + message + '\', ',
            'updated_at = now() ',
        ' WHERE ',
            'job_id = \'' + job.job_id + '\' ',
        ' RETURNING job_id;'
    ].join('\n');

    pg.query(failedJobQuery, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, result);
    });
};

JobService.prototype.getJob = function (pg, callback) {

    var getNextJob = "SELECT * FROM cdb_jobs WHERE status='pending' ORDER BY updated_at ASC LIMIT 1";

    pg.query(getNextJob, function (err, result) {
        if (err) {
            return callback(err);
        }

        callback(null, result.rows[0]);
    });
};


module.exports = JobService;
