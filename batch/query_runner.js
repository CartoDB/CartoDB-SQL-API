'use strict';

function QueryRunner() {
}

QueryRunner.prototype.run = function (pg, job, callback) {
    var self = this;

    console.log('QueryRunner.run');
    this.setJobRunning(pg, job, function (err) {
        if (err) {
            return callback(err);
        }

        self.job(pg, job.query, function (err, jobResult) {
            if (err) {
                self.setJobFailed(err, pg, job, function (err) {
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
                    callback(null, jobResult);
                });
            }
        });
    });
};

QueryRunner.prototype.job = function (pg, jobQuery, callback) {
    // TODO: wrap select query with select into
    pg(jobQuery, function (err, jobResult) {
        if (err) {
            return callback(err);
        }
        callback(null, jobResult);
    });
};

QueryRunner.prototype.setJobRunning = function (pg, job, callback) {
    var runningJobQuery = [
        'UPDATE cdb_jobs SET ',
            'status = \'running\'',
            'updated_at = ' + Date.now(),
        ' WHERE ',
            'job_id = \'' + job.job_id + '\', ',
        ') RETURNING job_id;'
    ].join('\n');

    pg(runningJobQuery, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, result);
    });
};

QueryRunner.prototype.setJobDone = function (pg, job, callback) {
    var doneJobQuery = [
        'UPDATE cdb_jobs SET ',
            'status = \'done\'',
            'updated_at = ' + Date.now(),
        ' WHERE ',
            'job_id = \'' + job.job_id + '\', ',
        ') RETURNING job_id;'
    ].join('\n');

    pg(doneJobQuery, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, result);
    });
};

QueryRunner.prototype.setJobFailed = function (err, pg, job, callback) {
    var failedJobQuery = [
        'UPDATE cdb_jobs SET ',
            'status = \'failed\'',
            'failed_reason = \'' + err.message + '\'',
            'updated_at = ' + Date.now(),
        ' WHERE ',
            'job_id = \'' + job.job_id + '\', ',
        ') RETURNING job_id;'
    ].join('\n');

    pg(failedJobQuery, function (err, result) {
        if (err) {
            return callback(err);
        }
        callback(null, result);
    });
};

module.exports = QueryRunner;
