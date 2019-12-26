'use strict';

require('../../helper');

var assert = require('../../support/assert');
var queue = require('queue-async');
var BatchTestClient = require('../../support/batch-test-client');
var JobStatus = require('../../../lib/batch/job-status');

describe('batch happy cases', function () {
    before(function () {
        this.batchTestClient = new BatchTestClient();
    });

    after(function (done) {
        this.batchTestClient.drain(done);
    });

    function jobPayload (query) {
        return {
            query: query
        };
    }

    it('should perform job with select', function (done) {
        var payload = jobPayload('select * from private_table');
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

    it('should perform job with select into', function (done) {
        var payload = jobPayload(`
            DROP TABLE IF EXISTS batch_test_table;
            SELECT * INTO batch_test_table FROM (SELECT * from private_table) AS job`);
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

    it('should perform job with select from result table', function (done) {
        var payload = jobPayload('select * from batch_test_table');
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

    it('should perform all enqueued jobs', function (done) {
        var self = this;

        var jobs = [
            'select * from private_table',
            'select * from private_table',
            'select * from private_table'
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

    it('should set all job as failed', function (done) {
        var self = this;

        var jobs = [
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table'
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
                assert.strictEqual(job.status, JobStatus.FAILED);
            });

            return done();
        });
    });

    it('should perform job with array of select', function (done) {
        var queries = ['select * from private_table limit 1', 'select * from private_table'];

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

    it('should set job as failed if last query fails', function (done) {
        var queries = ['select * from private_table', 'select * from undefined_table'];

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

    it('should set job as failed if first query fails', function (done) {
        var queries = ['select * from undefined_table', 'select * from private_table'];

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
});
