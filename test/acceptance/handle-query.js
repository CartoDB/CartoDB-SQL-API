'use strict';

require('../helper');

const server = require('../../app/server')();
const assert = require('../support/assert');
const qs = require('querystring');
const BatchTestClient = require('../support/batch-test-client');
const JobStatus = require('../../batch/job_status');

const QUERY = `SELECT 14 as foo`;
const API_KEY = 1234;

describe.only('Handle query middleware', function() {
    describe('regular queries endpoint', function() {
        ['GET', 'POST'].forEach(method => {
            it(`${method} without query fails`, function(done) {
                assert.response(server,
                    {
                        method,
                        url: '/api/v1/sql?' + qs.stringify({
                            api_key: API_KEY
                        }),
                        headers: {
                            host: 'vizzuality.cartodb.com'
                        }
                    },
                    { statusCode: 400 },
                    function(err, res) {
                        assert.ok(!err);

                        const response = JSON.parse(res.body);
                        assert.deepEqual(response, { error: ["You must indicate a sql query"] });

                        return done();
                    }
                );
            });

            it(`${method} query`, function(done) {
                assert.response(server,
                    {
                        method,
                        url: '/api/v1/sql?' + qs.stringify({
                            q: QUERY,
                            api_key: API_KEY
                        }),
                        headers: {
                            host: 'vizzuality.cartodb.com'
                        }
                    },
                    { statusCode: 200 },
                    function(err, res) {
                        assert.ok(!err);

                        const response = JSON.parse(res.body);
                        assert.equal(response.rows.length, 1);
                        assert.equal(response.rows[0].foo, 14);

                        return done();
                    }
                );
            });
        });
    });

    describe('batch api queries', function() {
        before(function() {
            this.batchTestClient = new BatchTestClient();
        });

        after(function(done) {
            this.batchTestClient.drain(done);
        });

        it('one query', function (done) {
            var payload = { query: QUERY };
            this.batchTestClient.createJob(payload, function(err, jobResult) {
                assert.ok(!err);

                jobResult.getStatus(function (err, job) {
                    assert.ok(!err);

                    assert.equal(job.status, JobStatus.DONE);
                    assert.equal(job.query, QUERY);

                    return done();
                });
            });
        });

        it('multiquery job with two queries', function (done) {
            var payload = { query: [QUERY, QUERY] };
            this.batchTestClient.createJob(payload, function(err, jobResult) {
                assert.ok(!err);

                jobResult.getStatus(function (err, job) {
                    assert.ok(!err);

                    assert.equal(job.status, JobStatus.DONE);
                    assert.deepEqual(job.query, [
                        { query: QUERY, status: JobStatus.DONE },
                        { query: QUERY, status: JobStatus.DONE },
                    ]);

                    return done();
                });
            });
        });
    });
});
