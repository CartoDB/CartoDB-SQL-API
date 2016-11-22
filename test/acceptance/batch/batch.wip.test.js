require('../../helper');

var assert = require('../../support/assert');
var BatchTestClient = require('../../support/batch-test-client');

describe('batch work in progress endpoint happy cases', function() {

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

    it('should get a list of work in progress jobs group by user', function (done) {
        var self = this;
        var user = 'vizzuality';
        var queries = ['select pg_sleep(0.5)'];
        var payload = jobPayload(queries);

        self.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }

            var interval = setInterval(function () {
                self.batchTestClient.getWorkInProgressJobs(function (err, workInProgressJobs) {
                    if (err) {
                        clearInterval(interval);
                        return done(err);
                    }
                    if (workInProgressJobs[user]) {
                        assert.ok(Array.isArray(workInProgressJobs[user]));
                        assert.ok(workInProgressJobs[user].length >= 1);
                        for (var i = 0; i < workInProgressJobs[user].length; i++) {
                            if (workInProgressJobs[user][i] === jobResult.job.job_id) {
                                clearInterval(interval);
                                return done();
                            }
                        }
                        clearInterval(interval);
                        return done(new Error('Job should not be in work-in-progress list'));
                    }
                });
            }, 50);
        });
    });

    it('should get a list of work in progress jobs w/o the finished ones', function (done) {
        var self = this;
        var user = 'vizzuality';
        var queries = ['select pg_sleep(0.05)'];
        var payload = jobPayload(queries);

        self.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }

            var interval = setInterval(function () {
                self.batchTestClient.getWorkInProgressJobs(function (err, workInProgressJobs) {
                    if (err) {
                        clearInterval(interval);
                        return done(err);
                    }

                    if (workInProgressJobs[user]) {
                        assert.ok(Array.isArray(workInProgressJobs[user]));
                        assert.ok(workInProgressJobs[user].length >= 1);
                        for (var i = 0; i < workInProgressJobs[user].length; i++) {
                            if (workInProgressJobs[user][i] === jobResult.job.job_id) {
                                clearInterval(interval);
                                return done(new Error('Job should not be in work-in-progress list'));
                            }
                        }
                    }
                    clearInterval(interval);
                    return done();
                });
            }, 50);
        });
    });
});
