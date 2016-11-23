require('../../helper');

var assert = require('../../support/assert');
var JobStatus = require('../../../batch/job_status');
var BatchTestClient = require('../../support/batch-test-client');

describe('Use case 7', function () {
    before(function() {
        this.batchTestClient = new BatchTestClient();
    });

    after(function(done) {
        this.batchTestClient.drain(done);
    });

    it('cancel a job with quotes', function (done) {
        var payload = {
            query: "SELECT name FROM untitle_table_4 WHERE name = 'Hawai'; select pg_sleep(3)"
        };

        this.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(JobStatus.RUNNING, function (err, job) {
                if (err) {
                    return done(err);
                }

                assert.equal(job.status, JobStatus.RUNNING);

                jobResult.cancel(function (err, job) {
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
