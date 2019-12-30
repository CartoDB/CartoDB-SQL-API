'use strict';

require('../../helper');
var assert = require('../../support/assert');

var TestClient = require('../../support/test-client');
var BatchTestClient = require('../../support/batch-test-client');
var JobStatus = require('../../../lib/batch/job-status');

describe('multiple batch clients job query order', function () {
    before(function (done) {
        this.batchTestClient1 = new BatchTestClient({ name: 'consumerA' });
        this.batchTestClient2 = new BatchTestClient({ name: 'consumerB' });

        this.testClient = new TestClient();
        this.testClient.getResult(
            'drop table if exists ordered_inserts; create table ordered_inserts (status numeric)',
            done
        );
    });

    after(function (done) {
        this.batchTestClient1.drain(function (err) {
            if (err) {
                return done(err);
            }

            this.batchTestClient2.drain(done);
        }.bind(this));
    });

    function createJob (queries) {
        return {
            query: queries
        };
    }

    it('should run job queries in order (multiple consumers)', function (done) {
        var jobRequest1 = createJob([
            'insert into ordered_inserts values(1)',
            'select pg_sleep(0.25)',
            'insert into ordered_inserts values(2)'
        ]);
        var jobRequest2 = createJob([
            'insert into ordered_inserts values(3)'
        ]);

        var self = this;

        this.batchTestClient1.createJob(jobRequest1, function (err, jobResult1) {
            if (err) {
                return done(err);
            }
            this.batchTestClient2.createJob(jobRequest2, function (err, jobResult2) {
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

                        self.testClient.getResult('select * from ordered_inserts', function (err, rows) {
                            assert.ok(!err);

                            assert.deepStrictEqual(rows, [{ status: 1 }, { status: 2 }, { status: 3 }]);
                            assert.ok(
                                new Date(job1.updated_at).getTime() < new Date(job2.updated_at).getTime(),
                                'job1 (' + job1.updated_at + ') should finish before job2 (' + job2.updated_at + ')'
                            );
                            done();
                        });
                    });
                });
            });
        }.bind(this));
    });
});
