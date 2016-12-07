require('../../helper');
var assert = require('../../support/assert');

var TestClient = require('../../support/test-client');
var BatchTestClient = require('../../support/batch-test-client');
var JobStatus = require('../../../batch/job_status');

describe('basic scheduling', function() {

    before(function(done) {
        this.batchTestClientA = new BatchTestClient({ name: 'consumerA' });
        this.batchTestClientB = new BatchTestClient({ name: 'consumerB' });

        this.testClient = new TestClient();
        this.testClient.getResult(
            [
                'drop table if exists ordered_inserts_a',
                'create table ordered_inserts_a (status numeric)'
            ].join(';'),
            done
        );
    });

    after(function (done) {
        this.batchTestClientA.drain(function(err) {
            if (err) {
                return done(err);
            }

            this.batchTestClientB.drain(done);
        }.bind(this));
    });

    function createJob(queries) {
        return {
            query: queries
        };
    }

    it('should run job queries in order (multiple consumers)', function (done) {
        var jobRequestA1 = createJob([
            "insert into ordered_inserts_a values(1)",
            "select pg_sleep(0.25)",
            "insert into ordered_inserts_a values(2)"
        ]);
        var jobRequestA2 = createJob([
            "insert into ordered_inserts_a values(3)"
        ]);

        var self = this;

        this.batchTestClientA.createJob(jobRequestA1, function(err, jobResultA1) {
            if (err) {
                return done(err);
            }

            // we don't care about the producer
            self.batchTestClientB.createJob(jobRequestA2, function(err, jobResultA2) {
                if (err) {
                    return done(err);
                }

                jobResultA1.getStatus(function (err, jobA1) {
                    if (err) {
                        return done(err);
                    }

                    jobResultA2.getStatus(function(err, jobA2) {
                        if (err) {
                            return done(err);
                        }
                        assert.equal(jobA1.status, JobStatus.DONE);
                        assert.equal(jobA2.status, JobStatus.DONE);

                        assert.ok(
                                new Date(jobA1.updated_at).getTime() < new Date(jobA2.updated_at).getTime(),
                                'A1 (' + jobA1.updated_at + ') ' +
                                'should finish before A2 (' + jobA2.updated_at + ')'
                        );

                        function statusMapper (status) { return { status: status }; }

                        self.testClient.getResult('select * from ordered_inserts_a', function(err, rows) {
                            assert.ok(!err);

                            // cartodb250user and vizzuality test users share database
                            var expectedRows = [1, 2, 3].map(statusMapper);
                            assert.deepEqual(rows, expectedRows);

                            return done();
                        });
                    });
                });
            });
        });
    });
});
