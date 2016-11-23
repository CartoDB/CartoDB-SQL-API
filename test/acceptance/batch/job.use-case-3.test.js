require('../../helper');

var assert = require('../../support/assert');
var JobStatus = require('../../../batch/job_status');
var BatchTestClient = require('../../support/batch-test-client');

describe('Use case 3', function () {
    before(function() {
        this.batchTestClient = new BatchTestClient();
    });

    after(function(done) {
        this.batchTestClient.drain(done);
    });

    it('cancel a pending job', function (done) {
        var self = this;
        var payload1 = {
            query: "SELECT * FROM untitle_table_4; select pg_sleep(3)"
        };

        this.batchTestClient.createJob(payload1, function(err, jobResult1) {
            if (err) {
                return done(err);
            }

            var payload2 = {
                query: "SELECT * FROM untitle_table_4"
            };

            self.batchTestClient.createJob(payload2, function(err, jobResult2) {
                if (err) {
                    return done(err);
                }

                jobResult2.getStatus(JobStatus.PENDING, function (err, job) {
                    if (err) {
                        return done(err);
                    }

                    assert.equal(job.status, JobStatus.PENDING);

                    jobResult2.cancel(function (err, job) {
                        if (err) {
                            return done(err);
                        }

                        assert.equal(job.status, JobStatus.CANCELLED);

                        jobResult1.cancel(function (err, job) {
                            if (err) {
                                return done(err);
                            }

                            assert.equal(job.status, JobStatus.CANCELLED);
                            done();
                        });

                    });
                });
            });
        });
    });
});
