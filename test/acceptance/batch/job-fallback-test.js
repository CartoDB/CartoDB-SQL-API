'use strict';

require('../../helper');

var assert = require('../../support/assert');
var JobStatus = require('../../../lib/batch/job-status');
var BatchTestClient = require('../../support/batch-test-client');

describe('Batch API fallback job', function () {
    before(function () {
        this.batchTestClient = new BatchTestClient();
    });

    after(function (done) {
        this.batchTestClient.drain(done);
    });

    it('"onsuccess" on first query should be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 1'
                }]
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 1',
                status: 'done',
                fallback_status: 'done'
            }]
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onerror" on first query should not be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4',
                    onerror: 'SELECT * FROM untitle_table_4 limit 1'
                }]
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4',
                onerror: 'SELECT * FROM untitle_table_4 limit 1',
                status: 'done',
                fallback_status: 'skipped'
            }]
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onerror" on first query should be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM nonexistent_table /* query should fail */',
                    onerror: 'SELECT * FROM untitle_table_4 limit 1'
                }]
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM nonexistent_table /* query should fail */',
                onerror: 'SELECT * FROM untitle_table_4 limit 1',
                status: 'failed',
                fallback_status: 'done',
                failed_reason: 'relation "nonexistent_table" does not exist'
            }]
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" on first query should not be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM nonexistent_table /* query should fail */',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 1'
                }]
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM nonexistent_table /* query should fail */',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 1',
                status: 'failed',
                fallback_status: 'skipped',
                failed_reason: 'relation "nonexistent_table" does not exist'
            }]
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" should be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4'
                }],
                onsuccess: 'SELECT * FROM untitle_table_4 limit 1'
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4',
                status: 'done'
            }],
            onsuccess: 'SELECT * FROM untitle_table_4 limit 1'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                assert.strictEqual(job.fallback_status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" should not be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM nonexistent_table /* query should fail */'
                }],
                onsuccess: 'SELECT * FROM untitle_table_4 limit 1'
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM nonexistent_table /* query should fail */',
                status: 'failed',
                failed_reason: 'relation "nonexistent_table" does not exist'
            }],
            onsuccess: 'SELECT * FROM untitle_table_4 limit 1'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                assert.strictEqual(job.fallback_status, JobStatus.SKIPPED);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onerror" should be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM nonexistent_table /* query should fail */'
                }],
                onerror: 'SELECT * FROM untitle_table_4 limit 1'
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM nonexistent_table /* query should fail */',
                status: 'failed',
                failed_reason: 'relation "nonexistent_table" does not exist'
            }],
            onerror: 'SELECT * FROM untitle_table_4 limit 1'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                assert.strictEqual(job.fallback_status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onerror" should not be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4'
                }],
                onerror: 'SELECT * FROM untitle_table_4 limit 1'
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4',
                status: 'done'
            }],
            onerror: 'SELECT * FROM untitle_table_4 limit 1'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                assert.strictEqual(job.fallback_status, JobStatus.SKIPPED);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" & "onsuccess" on query should be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 1'
                }],
                onsuccess: 'SELECT * FROM untitle_table_4 limit 2'
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 1',
                status: 'done',
                fallback_status: 'done'
            }],
            onsuccess: 'SELECT * FROM untitle_table_4 limit 2'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                assert.strictEqual(job.fallback_status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" for each query should be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 1'
                }, {
                    query: 'SELECT * FROM untitle_table_4 limit 2',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 3'
                }]
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 1',
                status: 'done',
                fallback_status: 'done'
            }, {
                query: 'SELECT * FROM untitle_table_4 limit 2',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 3',
                status: 'done',
                fallback_status: 'done'
            }]
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" for each query should not be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM nonexistent_table /* should fail */',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 1'
                }, {
                    query: 'SELECT * FROM untitle_table_4 limit 2',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 3'
                }]
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM nonexistent_table /* should fail */',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 1',
                status: 'failed',
                fallback_status: 'skipped',
                failed_reason: 'relation "nonexistent_table" does not exist'
            }, {
                query: 'SELECT * FROM untitle_table_4 limit 2',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 3',
                status: 'skipped',
                fallback_status: 'skipped'
            }]
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" for second query should not be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4 limit 2',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 1'
                }, {
                    query: 'SELECT * FROM nonexistent_table /* should fail */',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 3'
                }]
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4 limit 2',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 1',
                status: 'done',
                fallback_status: 'done'
            }, {
                query: 'SELECT * FROM nonexistent_table /* should fail */',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 3',
                status: 'failed',
                fallback_status: 'skipped',
                failed_reason: 'relation "nonexistent_table" does not exist'
            }]
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onerror" should not be triggered for any query and "skipped"', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4 limit 1',
                    onerror: 'SELECT * FROM untitle_table_4 limit 2'
                }, {
                    query: 'SELECT * FROM untitle_table_4 limit 3',
                    onerror: 'SELECT * FROM untitle_table_4 limit 4'
                }]
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4 limit 1',
                onerror: 'SELECT * FROM untitle_table_4 limit 2',
                status: 'done',
                fallback_status: 'skipped'
            }, {
                query: 'SELECT * FROM untitle_table_4 limit 3',
                onerror: 'SELECT * FROM untitle_table_4 limit 4',
                status: 'done',
                fallback_status: 'skipped'
            }]
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" should be "skipped"', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4 limit 1, /* should fail */',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 2'
                }]
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4 limit 1, /* should fail */',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 2',
                status: 'failed',
                fallback_status: 'skipped',
                failed_reason: 'syntax error at end of input'
            }]
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" should not be triggered and "skipped"', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4 limit 1, /* should fail */'
                }],
                onsuccess: 'SELECT * FROM untitle_table_4 limit 2'
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4 limit 1, /* should fail */',
                status: 'failed',
                failed_reason: 'syntax error at end of input'
            }],
            onsuccess: 'SELECT * FROM untitle_table_4 limit 2'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" for first query should fail', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4 limit 1',
                    onsuccess: 'SELECT * FROM nonexistent_table /* should fail */'
                }, {
                    query: 'SELECT * FROM untitle_table_4 limit 2',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 3'
                }]
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4 limit 1',
                onsuccess: 'SELECT * FROM nonexistent_table /* should fail */',
                status: 'done',
                fallback_status: 'failed',
                failed_reason: 'relation "nonexistent_table" does not exist'
            }, {
                query: 'SELECT * FROM untitle_table_4 limit 2',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 3',
                status: 'done',
                fallback_status: 'done'
            }]
        };
        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" for second query should fail', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4 limit 1',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 2'
                }, {
                    query: 'SELECT * FROM untitle_table_4 limit 3',
                    onsuccess: 'SELECT * FROM nonexistent_table /* should fail */'
                }]
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4 limit 1',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 2',
                status: 'done',
                fallback_status: 'done'
            }, {
                query: 'SELECT * FROM untitle_table_4 limit 3',
                onsuccess: 'SELECT * FROM nonexistent_table /* should fail */',
                status: 'done',
                fallback_status: 'failed',
                failed_reason: 'relation "nonexistent_table" does not exist'
            }]
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" for job & "onsuccess" for each query should be triggered', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4 limit 1',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 2'
                }, {
                    query: 'SELECT * FROM untitle_table_4 limit 3',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 4'
                }],
                onsuccess: 'SELECT * FROM untitle_table_4 limit 5'
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4 limit 1',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 2',
                status: 'done',
                fallback_status: 'done'
            }, {
                query: 'SELECT * FROM untitle_table_4 limit 3',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 4',
                status: 'done',
                fallback_status: 'done'
            }],
            onsuccess: 'SELECT * FROM untitle_table_4 limit 5'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                assert.strictEqual(job.fallback_status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" for job & "onsuccess" for each query should be triggered ' +
    '(even second "onsuccess" fails job should be done)', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4 limit 1',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 2'
                }, {
                    query: 'SELECT * FROM untitle_table_4 limit 3',
                    onsuccess: 'SELECT * FROM nonexistent_table /* should fail */'
                }],
                onsuccess: 'SELECT * FROM untitle_table_4 limit 5'
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4 limit 1',
                onsuccess: 'SELECT * FROM untitle_table_4 limit 2',
                status: 'done',
                fallback_status: 'done'
            }, {
                query: 'SELECT * FROM untitle_table_4 limit 3',
                onsuccess: 'SELECT * FROM nonexistent_table /* should fail */',
                status: 'done',
                fallback_status: 'failed',
                failed_reason: 'relation "nonexistent_table" does not exist'
            }],
            onsuccess: 'SELECT * FROM untitle_table_4 limit 5'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.DONE);
                assert.strictEqual(job.fallback_status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('should fail first "onerror" and job "onerror" and skip the other ones', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM atm_madrid limit 1, should fail',
                    onerror: 'SELECT * FROM atm_madrid limit 2'
                }, {
                    query: 'SELECT * FROM atm_madrid limit 3',
                    onerror: 'SELECT * FROM atm_madrid limit 4'
                }],
                onerror: 'SELECT * FROM atm_madrid limit 5'
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM atm_madrid limit 1, should fail',
                onerror: 'SELECT * FROM atm_madrid limit 2',
                status: 'failed',
                fallback_status: 'failed',
                failed_reason: 'relation "atm_madrid" does not exist'
            }, {
                query: 'SELECT * FROM atm_madrid limit 3',
                onerror: 'SELECT * FROM atm_madrid limit 4',
                status: 'skipped',
                fallback_status: 'skipped'
            }],
            onerror: 'SELECT * FROM atm_madrid limit 5'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                assert.strictEqual(job.fallback_status, JobStatus.FAILED);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('should run first "onerror" and job "onerror" and skip the other ones', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT * FROM untitle_table_4 limit 1, should fail',
                    onerror: 'SELECT * FROM untitle_table_4 limit 2'
                }, {
                    query: 'SELECT * FROM untitle_table_4 limit 3',
                    onerror: 'SELECT * FROM untitle_table_4 limit 4'
                }],
                onerror: 'SELECT * FROM untitle_table_4 limit 5'
            }
        };

        var expectedQuery = {
            query: [
                {
                    query: 'SELECT * FROM untitle_table_4 limit 1, should fail',
                    onerror: 'SELECT * FROM untitle_table_4 limit 2',
                    status: 'failed',
                    fallback_status: 'done',
                    failed_reason: 'LIMIT #,# syntax is not supported'
                },
                {
                    query: 'SELECT * FROM untitle_table_4 limit 3',
                    onerror: 'SELECT * FROM untitle_table_4 limit 4',
                    status: 'skipped',
                    fallback_status: 'skipped'
                }
            ],
            onerror: 'SELECT * FROM untitle_table_4 limit 5'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                assert.strictEqual(job.fallback_status, JobStatus.DONE);
                jobResult.validateExpectedResponse(expectedQuery);
                return done();
            });
        });
    });

    it('"onsuccess" for job & "onsuccess" for each query should not be triggered ' +
    ' because it has been cancelled', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT pg_sleep(3)',
                    onsuccess: 'SELECT pg_sleep(0)'
                }],
                onsuccess: 'SELECT pg_sleep(0)'
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT pg_sleep(3)',
                onsuccess: 'SELECT pg_sleep(0)',
                status: 'cancelled',
                fallback_status: 'skipped'
            }],
            onsuccess: 'SELECT pg_sleep(0)'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(JobStatus.RUNNING, function (err, job) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(job.status, JobStatus.RUNNING);

                jobResult.cancel(function (err, job) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(job.status, JobStatus.CANCELLED);
                    assert.strictEqual(job.fallback_status, JobStatus.SKIPPED);
                    jobResult.validateExpectedResponse(expectedQuery);
                    return done();
                });
            });
        });
    });

    it('first "onsuccess" should be triggered and it will be cancelled', function (done) {
        var payload = {
            query: {
                query: [{
                    query: 'SELECT pg_sleep(0)',
                    onsuccess: 'SELECT pg_sleep(3)'
                }],
                onsuccess: 'SELECT pg_sleep(0)'
            }
        };
        var expectedQuery = {
            query: [{
                query: 'SELECT pg_sleep(0)',
                onsuccess: 'SELECT pg_sleep(3)',
                status: 'done',
                fallback_status: 'cancelled'
            }],
            onsuccess: 'SELECT pg_sleep(0)'
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(JobStatus.RUNNING, function (err, job) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(job.status, JobStatus.RUNNING);

                jobResult.cancel(function (err, job) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(job.status, JobStatus.CANCELLED);
                    assert.strictEqual(job.fallback_status, JobStatus.SKIPPED);
                    jobResult.validateExpectedResponse(expectedQuery);
                    return done();
                });
            });
        });
    });
});
