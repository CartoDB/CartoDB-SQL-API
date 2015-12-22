'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var uuid = require('node-uuid');

function JobBackend(metadataBackend) {
    EventEmitter.call(this);
    this.metadataBackend = metadataBackend;
    this.db = 5;
}
util.inherits(JobBackend, EventEmitter);

JobBackend.prototype.create = function (username, sql, callback) {
    var self = this;
    var jobId = 'job:' + uuid.v4();
    var redisParams = [
        jobId,
        'user', username,
        'status', 'pending',
        'query', sql,
        'created_at', Date.now(),
        'updated_at', Date.now()
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams , function (err) {
        if (err) {
            return callback(err);
        }

        self.get(jobId, callback);
    });
};

JobBackend.prototype.get = function (jobId, callback) {
    var redisParams = [
        jobId,
        'user',
        'status',
        'query',
        'created_at',
        'updated_at'
    ];

    this.metadataBackend.redisCmd(this.db, 'HMGET', redisParams , function (err, jobValues) {
        if (err) {
            return callback(err);
        }

        if (!jobValues) {
            return callback(new Error('Job not found'));
        }

        callback(null, {
            jobId: jobId,
            user: jobValues[0],
            status: jobValues[1],
            query: jobValues[2],
            created_at: jobValues[3],
            updated_at: jobValues[4]
        });
    });
};

JobBackend.prototype.setRunning = function (job) {
    var self = this;
    var redisParams = [
        job.jobId,
        'status', 'running',
        'updated_at', Date.now()
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams, function (err) {
        if (err) {
            return self.emit('error', err);
        }

        self.emit('running', job);
    });
};

JobBackend.prototype.setDone = function (job) {
    var self = this;
    var redisParams = [
        job.jobId,
        'status', 'done',
        'updated_at', Date.now()
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams ,  function (err) {
        if (err) {
            return self.emit('error', err);
        }

        self.emit('done', job);
    });
};

JobBackend.prototype.setFailed = function (job, err) {
    var self = this;
    var redisParams = [
        job.jobId,
        'status', 'failed',
        'failed_reason', err.message,
        'updated_at', Date.now()
    ];

    this.metadataBackend.redisCmd(this.db, 'HMSET', redisParams , function (err) {
        if (err) {
            return self.emit('error', err);
        }

        self.emit('failed', job);
    });
};

module.exports = JobBackend;
