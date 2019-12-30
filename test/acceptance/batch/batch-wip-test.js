'use strict';

require('../../helper');

var assert = require('../../support/assert');
var BatchTestClient = require('../../support/batch-test-client');
var JobStatus = require('../../../lib/batch/job-status');

describe('batch work in progress endpoint happy cases', function () {
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

    it('should get a list of work in progress jobs group by user', function (done) {
        var self = this;
        var user = 'vizzuality';
        var queries = ['select pg_sleep(3)'];
        var payload = jobPayload(queries);

        self.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(JobStatus.RUNNING, function (err) {
                if (err) {
                    return done(err);
                }

                self.batchTestClient.getWorkInProgressJobs(function (err, workInProgressJobs) {
                    if (err) {
                        return done(err);
                    }

                    if (!workInProgressJobs[user]) {
                        return done(new Error('User should be in work-in-progress list'));
                    }

                    assert.ok(Array.isArray(workInProgressJobs[user]));
                    assert.ok(workInProgressJobs[user].length >= 1);
                    for (var i = 0; i < workInProgressJobs[user].length; i++) {
                        if (workInProgressJobs[user][i] === jobResult.job.job_id) {
                            return jobResult.cancel(done);
                        }
                    }

                    return done(new Error('Job should not be in work-in-progress list'));
                });
            });
        });
    });

    it('should get a list of work in progress jobs w/o the finished ones', function (done) {
        var self = this;
        var user = 'vizzuality';
        var queries = ['select pg_sleep(0)'];
        var payload = jobPayload(queries);

        self.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err) {
                if (err) {
                    return done(err);
                }

                self.batchTestClient.getWorkInProgressJobs(function (err, workInProgressJobs) {
                    if (err) {
                        return done(err);
                    }

                    if (workInProgressJobs[user]) {
                        assert.ok(Array.isArray(workInProgressJobs[user]));
                        assert.ok(workInProgressJobs[user].length >= 1);
                        for (var i = 0; i < workInProgressJobs[user].length; i++) {
                            if (workInProgressJobs[user][i] === jobResult.job.job_id) {
                                return done(new Error('Job should not be in work-in-progress list'));
                            }
                        }
                    }
                    done();
                });
            });
        });
    });
});
