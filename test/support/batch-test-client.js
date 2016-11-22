'use strict';

require('../helper');
var assert = require('assert');
var appServer = require('../../app/server');
var redisUtils = require('./redis_utils');
var debug = require('debug')('batch-test-client');

var JobStatus = require('../../batch/job_status');
var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var batchFactory = require('../../batch/index');

function response(code) {
    return {
        status: code
    };
}

var RESPONSE = {
    OK: response(200),
    CREATED: response(201)
};


function BatchTestClient(config) {
    this.config = config || {};
    this.server = appServer();

    this.batch = batchFactory(metadataBackend, redisUtils.getPool(), this.config.name);
    this.batch.start();

    this.pendingJobs = [];
    this.ready = false;
    this.batch.on('ready', function() {
        this.ready = true;
        this.pendingJobs.forEach(function(pendingJob) {
            this.createJob(pendingJob.job, pendingJob.callback);
        }.bind(this));
    }.bind(this));
}

module.exports = BatchTestClient;

BatchTestClient.prototype.isReady = function() {
    return this.ready;
};

BatchTestClient.prototype.createJob = function(job, override, callback) {
    if (!callback) {
        callback = override;
        override = {};
    }
    if (!this.isReady()) {
        this.pendingJobs.push({
            job: job,
            callback: callback
        });
        return debug('Waiting for Batch service to be ready');
    }
    assert.response(
        this.server,
        {
            url: this.getUrl(override),
            headers: {
                host: this.getHost(override),
                'Content-Type': 'application/json'
            },
            method: 'POST',
            data: JSON.stringify(job)
        },
        RESPONSE.CREATED,
        function (err, res) {
            if (err) {
                return callback(err);
            }
            return callback(null, new JobResult(JSON.parse(res.body), this, override));
        }.bind(this)
    );
};

BatchTestClient.prototype.getJobStatus = function(jobId, override, callback) {
    assert.response(
        this.server,
        {
            url: this.getUrl(override, jobId),
            headers: {
                host: this.getHost(override)
            },
            method: 'GET'
        },
        RESPONSE.OK,
        function (err, res) {
            if (err) {
                return callback(err);
            }
            return callback(null, JSON.parse(res.body));
        }
    );
};

BatchTestClient.prototype.getWorkInProgressJobs = function(override, callback) {
    if (!callback) {
        callback = override;
        override = {};
    }

    assert.response(
        this.server,
        {
            url: this.getUrl(override, 'wip'),
            headers: {
                host: this.getHost(override)
            },
            method: 'GET'
        },
        RESPONSE.OK,
        function (err, res) {
            if (err) {
                return callback(err);
            }
            return callback(null, JSON.parse(res.body));
        }
    );
};

BatchTestClient.prototype.cancelJob = function(jobId, override, callback) {
    assert.response(
        this.server,
        {
            url: this.getUrl(jobId),
            headers: {
                host: this.getHost(override)
            },
            method: 'DELETE'
        },
        RESPONSE.OK,
        function (err, res) {
            if (err) {
                return callback(err);
            }
            return callback(null, JSON.parse(res.body));
        }
    );
};

BatchTestClient.prototype.drain = function(callback) {
    this.batch.stop(function() {
        return redisUtils.clean('batch:*', callback);
    });
};

BatchTestClient.prototype.getHost = function(override) {
    return override.host || this.config.host || 'vizzuality.cartodb.com';
};

BatchTestClient.prototype.getUrl = function(override, jobId) {
    var urlParts = ['/api/v2/sql/job'];
    if (jobId) {
        urlParts.push(jobId);
    }
    return urlParts.join('/') + '?api_key=' + this.getApiKey(override);
};

BatchTestClient.prototype.getApiKey = function(override) {
    return override.apiKey || this.config.apiKey || '1234';
};

/****************** JobResult ******************/


function JobResult(job, batchTestClient, override) {
    this.job = job;
    this.batchTestClient = batchTestClient;
    this.override = override;
}

JobResult.prototype.getStatus = function(callback) {
    var self = this;
    var attempts = 1;
    var interval = setInterval(function () {
        self.batchTestClient.getJobStatus(self.job.job_id, self.override, function (err, job) {
            if (err) {
                clearInterval(interval);
                return callback(err);
            }
            attempts += 1;

            if (attempts > 10) {
                clearInterval(interval);
                return callback(new Error('Reached maximum number of request (10) to check job status'));
            }

            if (JobStatus.isFinal(job.status)) {
                clearInterval(interval);
                return callback(null, job);
            } else {
                debug('Job %s [status=%s] waiting to be done', self.job.job_id, job.status);
            }
        });
    }, 50);
};

JobResult.prototype.cancel = function(callback) {
    this.batchTestClient.cancelJob(this.job.job_id, this.override, callback);
};
