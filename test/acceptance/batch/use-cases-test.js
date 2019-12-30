'use strict';

require('../../helper');

var assert = require('../../support/assert');
var JobStatus = require('../../../lib/batch/job-status');
var BatchTestClient = require('../../support/batch-test-client');

describe('Use cases', function () {
    before(function () {
        this.batchTestClient = new BatchTestClient();
    });

    after(function (done) {
        this.batchTestClient.drain(done);
    });

    it('cancel a done job should return an error', function (done) {
        var payload = {
            query: 'SELECT * FROM untitle_table_4'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(JobStatus.DONE, function (err, job) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(job.status, JobStatus.DONE);

                jobResult.tryCancel(function (err, body) {
                    assert.ifError(err);
                    assert.strictEqual(body.error[0], 'Cannot set status from done to cancelled');
                    done();
                });
            });
        });
    });

    it('cancel a running job', function (done) {
        var payload = {
            query: 'SELECT * FROM untitle_table_4; select pg_sleep(3)'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(JobStatus.RUNNING, function (err, job) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(job.status, JobStatus.RUNNING);

                jobResult.cancel(function (err, job) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(job.status, JobStatus.CANCELLED);

                    jobResult.tryCancel(function (err, body) {
                        assert.ifError(err);
                        assert.strictEqual(body.error[0], 'Cannot set status from cancelled to cancelled');
                        done();
                    });
                });
            });
        });
    });

    it('cancel a pending job', function (done) {
        var self = this;
        var payload1 = {
            query: 'SELECT * FROM untitle_table_4; select pg_sleep(3)'
        };

        this.batchTestClient.createJob(payload1, function (err, jobResult1) {
            if (err) {
                return done(err);
            }

            var payload2 = {
                query: 'SELECT * FROM untitle_table_4'
            };

            self.batchTestClient.createJob(payload2, function (err, jobResult2) {
                if (err) {
                    return done(err);
                }

                jobResult2.getStatus(JobStatus.PENDING, function (err, job) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(job.status, JobStatus.PENDING);

                    jobResult2.cancel(function (err, job) {
                        if (err) {
                            return done(err);
                        }

                        assert.strictEqual(job.status, JobStatus.CANCELLED);

                        jobResult1.cancel(function (err, job) {
                            if (err) {
                                return done(err);
                            }

                            assert.strictEqual(job.status, JobStatus.CANCELLED);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('cancel a job with quotes', function (done) {
        var payload = {
            query: "SELECT name FROM untitle_table_4 WHERE name = 'Hawai'; select pg_sleep(3)"
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(JobStatus.RUNNING, function (err, job) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(job.status, JobStatus.RUNNING);

                jobResult.cancel(function (err, job) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(job.status, JobStatus.CANCELLED);
                    done();
                });
            });
        });
    });

    it('cancel a running multiquery job', function (done) {
        var payload = {
            query: [
                'select pg_sleep(1)',
                'select pg_sleep(1)',
                'select pg_sleep(1)'
            ]
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(JobStatus.RUNNING, function (err, job) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(job.status, JobStatus.RUNNING);

                jobResult.cancel(function (err, job) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(job.status, JobStatus.CANCELLED);

                    jobResult.tryCancel(function (err, body) {
                        assert.ifError(err);
                        assert.strictEqual(body.error[0], 'Cannot set status from cancelled to cancelled');
                        done();
                    });
                });
            });
        });
    });
});
