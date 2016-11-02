require('../../helper');

var assert = require('../../support/assert');
var queue = require('queue-async');
var BatchTestClient = require('../../support/batch-test-client');
var JobStatus = require('../../../batch/job_status');

describe('batch happy cases', function() {

    before(function() {
        this.batchTestClient = new BatchTestClient();
    });

    after(function(done) {
        this.batchTestClient.drain(done);
    });

    function jobPayload(query) {
        return {
            query: query
        };
    }

    it('should perform job with select', function (done) {
        var payload = jobPayload('select * from private_table');
        this.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.equal(job.status, JobStatus.DONE);
                return done();
            });
        });
    });

    it('should perform job with select into', function (done) {
        var payload = jobPayload('select * into batch_test_table from (select * from private_table) as job');
        this.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.equal(job.status, JobStatus.DONE);
                return done();
            });
        });
    });

    it('should perform job with select from result table', function (done) {
        var payload = jobPayload('select * from batch_test_table');
        this.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.equal(job.status, JobStatus.DONE);
                return done();
            });
        });
    });

    it('should perform all enqueued jobs', function (done) {
        var self = this;

        var jobs = [
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table'
        ];

        var jobsQueue = queue(4);

        jobs.forEach(function(job) {
            jobsQueue.defer(function(payload, done) {
                self.batchTestClient.createJob(payload, function(err, jobResult) {
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

            jobsCreated.forEach(function(job) {
                assert.equal(job.status, JobStatus.DONE);
            });

            return done();
        });
    });

    it('should set all job as failed', function (done) {
        var self = this;

        var jobs = [
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table'
        ];

        var jobsQueue = queue(4);

        jobs.forEach(function(job) {
            jobsQueue.defer(function(payload, done) {
                self.batchTestClient.createJob(payload, function(err, jobResult) {
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

            jobsCreated.forEach(function(job) {
                assert.equal(job.status, JobStatus.FAILED);
            });

            return done();
        });
    });

    it('should perform job with array of select', function (done) {
        var queries = ['select * from private_table limit 1', 'select * from private_table'];

        var payload = jobPayload(queries);
        this.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.equal(job.status, JobStatus.DONE);
                return done();
            });
        });
    });

    it('should set job as failed if last query fails', function (done) {
        var queries = ['select * from private_table', 'select * from undefined_table'];

        var payload = jobPayload(queries);
        this.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.equal(job.status, JobStatus.FAILED);
                return done();
            });
        });
    });

    it('should set job as failed if first query fails', function (done) {
        var queries = ['select * from undefined_table', 'select * from private_table'];

        var payload = jobPayload(queries);
        this.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.equal(job.status, JobStatus.FAILED);
                return done();
            });
        });
    });

    it('should get a list of work in progress jobs group by user', function (done) {
        var self = this;
        var user = 'vizzuality';
        var queries = ['select pg_sleep(0.5)'];
        var payload = jobPayload(queries);

        self.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }

            setTimeout(function () {
                self.batchTestClient.getWorkInProgressJobs(function (err, workInProgressJobs) {
                    if (err) {
                        return done(err);
                    }
                    assert.ok(Array.isArray(workInProgressJobs[user]));
                    assert.ok(workInProgressJobs[user].length >= 1);
                    for (var i = 0; i < workInProgressJobs[user].length; i++) {
                        if (workInProgressJobs[user][i] === jobResult.job.job_id) {
                            return done();
                        }
                    }
                });
            }, 100);
        });
    });

    it('should get a list of work in progress jobs w/o the finished ones', function (done) {
        var self = this;
        var user = 'vizzuality';
        var queries = ['select pg_sleep(0.1)'];
        var payload = jobPayload(queries);

        self.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }
            setTimeout(function () {
                self.batchTestClient.getWorkInProgressJobs(function (err, workInProgressJobs) {
                    if (err) {
                        return done(err);
                    }
                    assert.ok(Array.isArray(workInProgressJobs[user]));
                    assert.ok(workInProgressJobs[user].length >= 1);
                    for (var i = 0; i < workInProgressJobs[user].length; i++) {
                        if (workInProgressJobs[user][i] === jobResult.job.job_id) {
                            return done(new Error('Job should not be in work-in-progress list'));
                        }
                    }
                    return done();
                });
            }, 200);
        });
    });
});
