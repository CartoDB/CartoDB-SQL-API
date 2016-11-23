require('../../helper');

var assert = require('../../support/assert');
var JobStatus = require('../../../batch/job_status');
var BatchTestClient = require('../../support/batch-test-client');

describe('Use case 1: cancel and modify a done job', function () {
    before(function() {
        this.batchTestClient = new BatchTestClient();
    });

    after(function(done) {
        this.batchTestClient.drain(done);
    });

    it('cancel a done job should return an error', function (done) {
        var payload = {
            query: "SELECT * FROM untitle_table_4"
        };

        this.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(JobStatus.DONE, function (err) {
                if (err) {
                    return done(err);
                }

                jobResult.tryCancel(function (err, body) {
                    assert.equal(body.error[0], "Cannot set status from done to cancelled");
                    done();
                });
            });
        });
    });
});
