'use strict';

require('../../helper');

var BatchTestClient = require('../../support/batch-test-client');
var JobStatus = require('../../../lib/batch/job-status');

describe('Batch API query timing', function () {
    before(function () {
        this.batchTestClient = new BatchTestClient();
    });

    after(function (done) {
        this.batchTestClient.drain(done);
    });

    it('should report start and end time for each query with fallback queries' +
        'and expose started_at and ended_at for all queries with fallback mechanism', function (done) {
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
            }],
            onerror: 'SELECT * FROM untitle_table_4 limit 5'
        };

        var payload = {
            query: {
                query: [
                    {
                        query: 'SELECT * FROM untitle_table_4 limit 1',
                        onerror: 'SELECT * FROM untitle_table_4 limit 2'
                    },
                    {
                        query: 'SELECT * FROM untitle_table_4 limit 3',
                        onerror: 'SELECT * FROM untitle_table_4 limit 4'
                    }
                ],
                onerror: 'SELECT * FROM untitle_table_4 limit 5'
            }
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(function (err) {
                if (err) {
                    return done(err);
                }

                jobResult.validateExpectedResponse(expectedQuery);
                done();
            });
        });
    });

    it('should report start and end time for each query also for failing queries' +
        'and expose started_at and ended_at for all queries with fallback mechanism (failed)', function (done) {
        var expectedQuery = {
            query: [{
                query: 'SELECT * FROM untitle_table_4 limit 1',
                onerror: 'SELECT * FROM untitle_table_4 limit 2',
                status: 'done',
                fallback_status: 'skipped'
            }, {
                query: 'SELECT * FROM untitle_table_4 limit 3 failed',
                onerror: 'SELECT * FROM untitle_table_4 limit 4',
                status: 'failed',
                fallback_status: 'done'
            }],
            onerror: 'SELECT * FROM untitle_table_4 limit 5'
        };

        var payload = {
            query: {
                query: [
                    {
                        query: 'SELECT * FROM untitle_table_4 limit 1',
                        onerror: 'SELECT * FROM untitle_table_4 limit 2'
                    },
                    {
                        query: 'SELECT * FROM untitle_table_4 limit 3 failed',
                        onerror: 'SELECT * FROM untitle_table_4 limit 4'
                    }
                ],
                onerror: 'SELECT * FROM untitle_table_4 limit 5'
            }
        };

        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }

            jobResult.getStatus(JobStatus.FAILED, function (err) {
                if (err) {
                    return done(err);
                }

                jobResult.validateExpectedResponse(expectedQuery);
                done();
            });
        });
    });
});
