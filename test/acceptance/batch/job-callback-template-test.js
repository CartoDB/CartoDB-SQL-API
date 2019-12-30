'use strict';

require('../../helper');

var assert = require('../../support/assert');
var TestClient = require('../../support/test-client');
var JobStatus = require('../../../lib/batch/job-status');
var BatchTestClient = require('../../support/batch-test-client');

describe('Batch API callback templates', function () {
    before(function () {
        this.batchTestClient = new BatchTestClient();
        this.testClient = new TestClient();
    });

    after(function (done) {
        this.batchTestClient.drain(done);
    });

    it('should use templates for error_message and job_id onerror callback' +
        ' and keep the original templated query but use the error message', function (done) {
        var self = this;
        var payload = {
            query: {
                query: [
                    {
                        query: 'SELECT * FROM invalid_table',
                        onerror: 'INSERT INTO test_batch_errors ' +
                        "values ('<%= job_id %>', '<%= error_message %>')"
                    }
                ]
            }
        };
        var expectedQuery = {
            query: [
                {
                    query: 'SELECT * FROM invalid_table',
                    onerror: "INSERT INTO test_batch_errors values ('<%= job_id %>', '<%= error_message %>')",
                    status: 'failed',
                    fallback_status: 'done'
                }
            ]
        };

        self.testClient.getResult(
            'BEGIN; DROP TABLE IF EXISTS test_batch_errors; ' +
            'CREATE TABLE test_batch_errors (job_id text, error_message text); COMMIT', function (err) {
                if (err) {
                    return done(err);
                }

                self.batchTestClient.createJob(payload, function (err, jobResult) {
                    if (err) {
                        return done(err);
                    }

                    jobResult.getStatus(JobStatus.FAILED, function (err, job) {
                        if (err) {
                            return done(err);
                        }
                        jobResult.validateExpectedResponse(expectedQuery);
                        self.testClient.getResult('select * from test_batch_errors', function (err, rows) {
                            if (err) {
                                return done(err);
                            }
                            assert.strictEqual(rows[0].job_id, job.job_id);
                            assert.strictEqual(rows[0].error_message, 'relation "invalid_table" does not exist');
                            self.testClient.getResult('drop table test_batch_errors', done);
                        });
                    });
                });
            });
    });

    it('should use template for job_id onsuccess callback ' +
        'and keep the original templated query but use the job_id', function (done) {
        var self = this;
        var payload = {
            query: {
                query: [
                    {
                        query: 'drop table if exists batch_jobs; create table batch_jobs (job_id text)'
                    },
                    {
                        query: 'SELECT 1',
                        onsuccess: "INSERT INTO batch_jobs values ('<%= job_id %>')"
                    }
                ]
            }
        };
        var expectedQuery = {
            query: [
                {
                    query: 'drop table if exists batch_jobs; create table batch_jobs (job_id text)',
                    status: 'done'
                },
                {
                    query: 'SELECT 1',
                    onsuccess: "INSERT INTO batch_jobs values ('<%= job_id %>')",
                    status: 'done',
                    fallback_status: 'done'
                }
            ]
        };

        self.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }

                jobResult.validateExpectedResponse(expectedQuery);
                self.testClient.getResult('select * from batch_jobs', function (err, rows) {
                    if (err) {
                        return done(err);
                    }
                    assert.strictEqual(rows[0].job_id, job.job_id);

                    self.testClient.getResult('drop table batch_jobs', done);
                });
            });
        });
    });
});
