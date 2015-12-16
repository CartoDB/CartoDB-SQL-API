'use strict';

var PSQL = require('cartodb-psql');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

function Job() {
    EventEmitter.call(this);
}
util.inherits(Job, EventEmitter);

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

            self.emit('job:running', job);

            self.runJob(pg, job, function (err, jobResult) {
                if (err) {
                    return self.setJobFailed(pg, job, err.message, function () {
                        self.emit('job:failed', { job: job.job_id, error: err });
                        callback(err);
                    });
                }

                self.setJobDone(pg, job, function () {
                    self.emit('job:done', job);
                    callback(null, jobResult);
                });
            });
        });
    });
};

Job.prototype.createJob = function (pg, username, sql, callback) {
    var persistJobQuery = [
        'INSERT INTO cdb_jobs (',
            'user_id, query',
        ') VALUES (',
            '\'' + username + '\', ',
            '\'' + sql + '\' ',
        ') RETURNING job_id;'
    ].join('\n');

    pg.query(persistJobQuery, callback);
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

    pg.query(doneJobQuery, callback);
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

    pg.query(failedJobQuery, callback);
};

module.exports = Job;
