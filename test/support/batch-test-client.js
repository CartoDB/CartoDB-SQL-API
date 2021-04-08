'use strict';

require('../helper');
var assert = require('assert');
var appServer = require('../../lib/server');
var redisUtils = require('./redis-utils');
var debug = require('debug')('batch-test-client');

var JobStatus = require('../../lib/batch/job-status');
var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var batchFactory = require('../../lib/batch/index');
var Logger = require('../../lib/utils/logger');

function response (code) {
    return {
        status: code
    };
}

var RESPONSE = {
    OK: response(200),
    CREATED: response(201),
    BAD_REQUEST: response(400)
};

function BatchTestClient (config) {
    this.config = config || {};
    this.server = appServer();

    const logger = new Logger();
    this.batch = batchFactory(metadataBackend, redisUtils.getPool(), this.config.name, undefined, logger);
    this.batch.start();

    this.pendingJobs = [];
    this.ready = false;
    this.batch.on('ready', function () {
        this.ready = true;
        this.pendingJobs.forEach(function (pendingJob) {
            this.createJob(pendingJob.job, pendingJob.override, pendingJob.callback);
        }.bind(this));
    }.bind(this));
}

module.exports = BatchTestClient;

BatchTestClient.prototype.isReady = function () {
    return this.ready;
};

BatchTestClient.prototype.getExpectedResponse = function (override) {
    return override.response || this.config.response || RESPONSE.CREATED;
};

BatchTestClient.prototype.createJob = function (job, override, callback) {
    if (!callback) {
        callback = override;
        override = {};
    }
    if (!this.isReady()) {
        this.pendingJobs.push({
            job: job,
            override: override || {},
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
                'Content-Type': 'application/json',
                authorization: this.getAuthorization(override)
            },
            method: 'POST',
            data: JSON.stringify(job)
        },
        this.getExpectedResponse(override),
        function (err, res) {
            if (err) {
                return callback(err);
            }

            if (res.statusCode < 400) {
                return callback(null, new JobResult(JSON.parse(res.body), this, override), res);
            } else {
                return callback(null, res);
            }
        }.bind(this)
    );
};

BatchTestClient.prototype.getJobStatus = function (jobId, override, callback) {
    assert.response(
        this.server,
        {
            url: this.getUrl(override, jobId),
            headers: {
                host: this.getHost(override),
                authorization: this.getAuthorization(override)
            },
            method: 'GET',
            timeout: override.timeout
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

BatchTestClient.prototype.getWorkInProgressJobs = function (override, callback) {
    if (!callback) {
        callback = override;
        override = {};
    }

    assert.response(
        this.server,
        {
            url: '/api/v1/jobs-wip',
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

BatchTestClient.prototype.cancelJob = function (jobId, override, callback) {
    assert.response(
        this.server,
        {
            url: this.getUrl(override, jobId),
            headers: {
                host: this.getHost(override)
            },
            method: 'DELETE'
        },
        override.statusCode,
        function (err, res) {
            if (err) {
                return callback(err);
            }
            return callback(null, JSON.parse(res.body));
        }
    );
};

BatchTestClient.prototype.drain = function (callback) {
    this.batch.stop(function () {
        return redisUtils.clean(global.settings.batch_db, 'batch:*', callback);
    });
};

BatchTestClient.prototype.getHost = function (override) {
    return override.host || this.config.host || 'vizzuality.cartodb.com';
};

BatchTestClient.prototype.getAuthorization = function (override) {
    const auth = override.authorization || this.config.authorization;

    if (auth) {
        return `Basic ${Buffer.from(auth).toString('base64')}`;
    }
};

BatchTestClient.prototype.getUrl = function (override, jobId) {
    var urlParts = ['/api/v2/sql/job'];
    if (jobId) {
        urlParts.push(jobId);
    }
    return `${urlParts.join('/')}${override.anonymous ? '' : '?api_key=' + this.getApiKey(override)}`;
};

BatchTestClient.prototype.getApiKey = function (override) {
    return override.apiKey || this.config.apiKey || '1234';
};

/** **************** JobResult ******************/

function JobResult (job, batchTestClient, override) {
    this.job = job;
    this.batchTestClient = batchTestClient;
    this.override = override;
}

JobResult.prototype.getStatus = function (requiredStatus, callback) {
    if (!callback) {
        callback = requiredStatus;
        requiredStatus = undefined;
    }

    var self = this;
    var attempts = 1;
    self.override.timeout = 1000;

    var interval = setInterval(function () {
        self.batchTestClient.getJobStatus(self.job.job_id, self.override, function (err, job) {
            if (err) {
                clearInterval(interval);
                return callback(err);
            }
            attempts += 1;

            if (attempts > 20) {
                clearInterval(interval);
                return callback(new Error('Reached maximum number of request (20) to check job status'));
            }

            if (hasRequiredStatus(job, requiredStatus)) {
                clearInterval(interval);
                self.job = job;
                return callback(null, job);
            } else {
                debug('Job %s [status=%s] waiting to be done', self.job.job_id, job.status);
            }
        });
    }, 100);
};

function hasRequiredStatus (job, requiredStatus) {
    if (requiredStatus) {
        return job.status === requiredStatus;
    }

    if (JobStatus.isFinal(job.status)) {
        if (job.fallback_status !== undefined) {
            if (JobStatus.isFinal(job.fallback_status) || job.fallback_status === JobStatus.SKIPPED) {
                return true;
            }
        } else {
            return true;
        }
    }

    return false;
}

JobResult.prototype.cancel = function (callback) {
    var self = this;
    this.override.statusCode = response(RESPONSE.OK);
    this.batchTestClient.cancelJob(this.job.job_id, this.override, function (err, job) {
        if (err) {
            return callback(err);
        }
        self.job = job;
        callback(null, job);
    });
};

JobResult.prototype.tryCancel = function (callback) {
    var self = this;
    this.override.statusCode = response();
    this.batchTestClient.cancelJob(this.job.job_id, this.override, function (err, job) {
        if (err) {
            return callback(err);
        }
        self.job = job;
        callback(null, job);
    });
};

JobResult.prototype.validateExpectedResponse = function (expected) {
    var actual = this.job.query;

    actual.query.forEach(function (actualQuery, index) {
        var expectedQuery = expected.query[index];
        assert.ok(expectedQuery);
        Object.keys(expectedQuery).forEach(function (expectedKey) {
            assert.strictEqual(
                actualQuery[expectedKey],
                expectedQuery[expectedKey],
                'Expected value for key "' + expectedKey + '" does not match: ' + actualQuery[expectedKey] + ' ==' +
                expectedQuery[expectedKey] + ' at query index=' + index + '. Full response: ' +
                JSON.stringify(actual, null, 4)
            );
        });
        var propsToCheckDate = ['started_at', 'ended_at'];
        propsToCheckDate.forEach(function (propToCheckDate) {
            if (Object.prototype.hasOwnProperty.call(actualQuery, propToCheckDate)) {
                assert.ok(new Date(actualQuery[propToCheckDate]));
            }
        });
    });

    assert.strictEqual(actual.onsuccess, expected.onsuccess);
    assert.strictEqual(actual.onerror, expected.onerror);
};
