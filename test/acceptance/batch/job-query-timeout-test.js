'use strict';

require('../../helper');
var assert = require('../../support/assert');

var BatchTestClient = require('../../support/batch-test-client');
var JobStatus = require('../../../lib/batch/job-status');

describe('job query timeout', function () {
    before(function () {
        this.batchQueryTimeout = global.settings.batch_query_timeout;
        this.batchTestClient = new BatchTestClient();
    });

    after(function (done) {
        global.settings.batch_query_timeout = this.batchQueryTimeout;
        return this.batchTestClient.drain(done);
    });

    function createTimeoutQuery (query, timeout) {
        return {
            query: {
                query: [
                    {
                        timeout: timeout,
                        query: query
                    }
                ]
            }
        };
    }

    it('should run query with higher user timeout', function (done) {
        var jobRequest = createTimeoutQuery('select pg_sleep(0.1)', 200);
        this.batchTestClient.createJob(jobRequest, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                done();
            });
        });
    });

    it('should fail to run query with lower user timeout', function (done) {
        var jobRequest = createTimeoutQuery('select pg_sleep(0.1)', 50);
        this.batchTestClient.createJob(jobRequest, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                done();
            });
        });
    });

    it('should fail to run query with user timeout if it is higher than config', function (done) {
        global.settings.batch_query_timeout = 100;
        var jobRequest = createTimeoutQuery('select pg_sleep(1)', 2000);
        this.batchTestClient.createJob(jobRequest, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                done();
            });
        });
    });

    it('should fail to run query with user timeout if set to 0 (ignored timeout)', function (done) {
        global.settings.batch_query_timeout = 100;
        var jobRequest = createTimeoutQuery('select pg_sleep(1)', 0);
        this.batchTestClient.createJob(jobRequest, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                done();
            });
        });
    });
});
