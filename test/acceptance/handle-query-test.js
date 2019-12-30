'use strict';

require('../helper');

const server = require('../../lib/server')();
const assert = require('../support/assert');
const qs = require('querystring');
const BatchTestClient = require('../support/batch-test-client');
const JobStatus = require('../../lib/batch/job-status');

const QUERY = 'SELECT 14 as foo';
const API_KEY = 1234;

describe('Handle query middleware', function () {
    describe('regular queries endpoint', function () {
        ['GET', 'POST'].forEach(method => {
            it(`${method} without query fails`, function (done) {
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
                    function (err, res) {
                        assert.ok(!err);

                        const response = JSON.parse(res.body);
                        assert.deepStrictEqual(response, { error: ['You must indicate a sql query'] });

                        return done();
                    }
                );
            });

            it(`${method} query`, function (done) {
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
                    function (err, res) {
                        assert.ok(!err);

                        const response = JSON.parse(res.body);
                        assert.strictEqual(response.rows.length, 1);
                        assert.strictEqual(response.rows[0].foo, 14);

                        return done();
                    }
                );
            });
        });
    });

    describe('batch api queries', function () {
        before(function () {
            this.batchTestClient = new BatchTestClient();
        });

        after(function (done) {
            this.batchTestClient.drain(done);
        });

        it('one query', function (done) {
            var payload = { query: QUERY };
            this.batchTestClient.createJob(payload, function (err, jobResult) {
                assert.ok(!err);

                jobResult.getStatus(function (err, job) {
                    assert.ok(!err);

                    assert.strictEqual(job.status, JobStatus.DONE);
                    assert.strictEqual(job.query, QUERY);

                    return done();
                });
            });
        });

        it('multiquery job with two queries', function (done) {
            var payload = { query: [QUERY, QUERY] };
            this.batchTestClient.createJob(payload, function (err, jobResult) {
                assert.ok(!err);

                jobResult.getStatus(function (err, job) {
                    assert.ok(!err);

                    assert.strictEqual(job.status, JobStatus.DONE);
                    assert.deepStrictEqual(job.query, [
                        { query: QUERY, status: JobStatus.DONE },
                        { query: QUERY, status: JobStatus.DONE }
                    ]);

                    return done();
                });
            });
        });
    });
});
