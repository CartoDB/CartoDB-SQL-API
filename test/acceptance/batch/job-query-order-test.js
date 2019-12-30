'use strict';

require('../../helper');
var assert = require('../../support/assert');

var BatchTestClient = require('../../support/batch-test-client');
var JobStatus = require('../../../lib/batch/job-status');

describe('job query order', function () {
    before(function () {
        this.batchTestClient = new BatchTestClient();
    });

    after(function (done) {
        return this.batchTestClient.drain(done);
    });

    function createJob (queries) {
        return {
            query: queries
        };
    }

    it('should run job queries in order (single consumer)', function (done) {
        var jobRequest1 = createJob(['select 1', 'select 2']);
        var jobRequest2 = createJob(['select 3']);

        this.batchTestClient.createJob(jobRequest1, function (err, jobResult1) {
            if (err) {
                return done(err);
            }
            this.batchTestClient.createJob(jobRequest2, function (err, jobResult2) {
                if (err) {
                    return done(err);
                }

                jobResult1.getStatus(function (err, job1) {
                    if (err) {
                        return done(err);
                    }
                    jobResult2.getStatus(function (err, job2) {
                        if (err) {
                            return done(err);
                        }
                        assert.strictEqual(job1.status, JobStatus.DONE);
                        assert.strictEqual(job2.status, JobStatus.DONE);
                        assert.ok(
                            new Date(job1.updated_at).getTime() < new Date(job2.updated_at).getTime(),
                            'job1 (' + job1.updated_at + ') should finish before job2 (' + job2.updated_at + ')'
                        );
                        done();
                    });
                });
            });
        }.bind(this));
    });
});
