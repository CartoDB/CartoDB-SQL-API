'use strict';

require('../../helper');

var BatchTestClient = require('../../support/batch-test-client');
var JobStatus = require('../../../lib/batch/job-status');

var assert = require('../../support/assert');
var queue = require('queue-async');

describe('batch multiquery', function () {
    function jobPayload (query) {
        return {
            query: query
        };
    }

    before(function () {
        this.batchTestClient = new BatchTestClient();
    });

    after(function (done) {
        this.batchTestClient.drain(done);
    });

    it('should perform one multiquery job with two queries', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select pg_sleep(0)'
        ];

        var payload = jobPayload(queries);
        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                return done();
            });
        });
    });

    it('should perform one multiquery job with two queries and fail on last one', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select shouldFail()'
        ];

        var payload = jobPayload(queries);
        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                return done();
            });
        });
    });

    it('should perform one multiquery job with three queries and fail on last one', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select pg_sleep(0)',
            'select shouldFail()'
        ];

        var payload = jobPayload(queries);
        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                return done();
            });
        });
    });

    it('should perform one multiquery job with three queries and fail on second one', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select shouldFail()',
            'select pg_sleep(0)'
        ];

        var payload = jobPayload(queries);
        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                return done();
            });
        });
    });

    it('should perform two multiquery job with two queries for each one', function (done) {
        var self = this;

        var jobs = [
            [
                'select pg_sleep(0)',
                'select pg_sleep(0)'
            ],
            [
                'select pg_sleep(0)',
                'select pg_sleep(0)'
            ]
        ];

        var jobsQueue = queue(1);

        jobs.forEach(function (job) {
            jobsQueue.defer(function (payload, done) {
                self.batchTestClient.createJob(payload, function (err, jobResult) {
                    if (err) {
                        return done(err);
                    }
                    jobResult.getStatus(done);
                });
            }, jobPayload(job));
        });

        jobsQueue.awaitAll(function (err, jobsCreated) {
            if (err) {
                return done(err);
            }

            jobsCreated.forEach(function (job) {
                assert.strictEqual(job.status, JobStatus.DONE);
            });

            return done();
        });
    });

    it('should perform two multiquery job with two queries for each one and fail the first one', function (done) {
        var self = this;

        var jobs = [
            [
                'select pg_sleep(0)',
                'select shouldFail()'
            ],
            [
                'select pg_sleep(0)',
                'select pg_sleep(0)'
            ]
        ];

        var expectedStatus = [JobStatus.FAILED, JobStatus.DONE];
        var jobsQueue = queue(1);

        jobs.forEach(function (job) {
            jobsQueue.defer(function (payload, done) {
                self.batchTestClient.createJob(payload, function (err, jobResult) {
                    if (err) {
                        return done(err);
                    }
                    jobResult.getStatus(done);
                });
            }, jobPayload(job));
        });

        jobsQueue.awaitAll(function (err, jobsCreated) {
            if (err) {
                return done(err);
            }

            var statuses = jobsCreated.map(function (job) {
                return job.status;
            });
            assert.deepStrictEqual(statuses, expectedStatus);

            return done();
        });
    });

    it('should perform two multiquery job with two queries for each one and fail the second one', function (done) {
        var self = this;

        var jobs = [
            [
                'select pg_sleep(0)',
                'select pg_sleep(0)'
            ],
            [
                'select pg_sleep(0)',
                'select shouldFail()'
            ]
        ];

        var expectedStatus = [JobStatus.DONE, JobStatus.FAILED];
        var jobsQueue = queue(1);

        jobs.forEach(function (job) {
            jobsQueue.defer(function (payload, done) {
                self.batchTestClient.createJob(payload, function (err, jobResult) {
                    if (err) {
                        return done(err);
                    }
                    jobResult.getStatus(done);
                });
            }, jobPayload(job));
        });

        jobsQueue.awaitAll(function (err, jobsCreated) {
            if (err) {
                return done(err);
            }

            var statuses = jobsCreated.map(function (job) {
                return job.status;
            });
            assert.deepStrictEqual(statuses, expectedStatus);

            return done();
        });
    });
});
