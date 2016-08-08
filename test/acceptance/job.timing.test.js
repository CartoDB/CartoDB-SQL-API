require('../helper');

var assert = require('../support/assert');
var app = require(global.settings.app_root + '/app/app')();
var querystring = require('qs');
var redisConfig = {
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
};
var metadataBackend = require('cartodb-redis')(redisConfig);
var batchFactory = require('../../batch');
var jobStatus = require('../../batch/job_status');

describe('Batch API query timing', function () {

    function createJob(jobDefinition, callback) {
        assert.response(app, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                host: 'vizzuality.cartodb.com'
            },
            method: 'POST',
            data: querystring.stringify(jobDefinition)
        }, {
            status: 201
        }, function (res, err) {
            if (err) {
                return callback(err);
            }
            return callback(null, JSON.parse(res.body));
        });
    }

    function getJobStatus(jobId, callback) {
        assert.response(app, {
            url: '/api/v2/sql/job/' + jobId + '?api_key=1234&',
            headers: {
                host: 'vizzuality.cartodb.com'
            },
            method: 'GET'
        }, {
            status: 200
        }, function (res, err) {
            if (err) {
                return callback(err);
            }
            return callback(null, JSON.parse(res.body));
        });
    }

    function validateExpectedResponse(actual, expected) {
        actual.query.forEach(function(actualQuery, index) {
            var expectedQuery = expected.query[index];
            assert.ok(expectedQuery);
            Object.keys(expectedQuery).forEach(function(expectedKey) {
                assert.equal(actualQuery[expectedKey], expectedQuery[expectedKey]);
            });
            var propsToCheckDate = ['started_at', 'ended_at'];
            propsToCheckDate.forEach(function(propToCheckDate) {
                if (actualQuery.hasOwnProperty(propToCheckDate)) {
                    assert.ok(new Date(actualQuery[propToCheckDate]));
                }
            });
        });

        assert.equal(actual.onsuccess, expected.onsuccess);
        assert.equal(actual.onerror, expected.onerror);
    }

    var batch = batchFactory(metadataBackend, redisConfig);

    before(function () {
        batch.start();
    });

    after(function (done) {
        batch.stop();
        batch.drain(function () {
            metadataBackend.redisCmd(5, 'DEL', [ 'batch:queues:localhost' ], done);
        });
    });

    describe('should report start and end time for each query with fallback queries', function () {
        var jobResponse;
        before(function(done) {
            createJob({
                "query": {
                    "query": [
                        {
                            "query": "SELECT * FROM untitle_table_4 limit 1",
                            "onerror": "SELECT * FROM untitle_table_4 limit 2"
                        },
                        {
                            "query": "SELECT * FROM untitle_table_4 limit 3",
                            "onerror": "SELECT * FROM untitle_table_4 limit 4"
                        }
                    ],
                    "onerror": "SELECT * FROM untitle_table_4 limit 5"
                }
            }, function(err, job) {
                jobResponse = job;
                return done(err);
            });
        });

        it('should expose started_at and ended_at for all queries with fallback mechanism', function (done) {
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

            var interval = setInterval(function () {
                getJobStatus(jobResponse.job_id, function(err, job) {
                    if (job.status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        job.query.query.forEach(function(actualQuery) {
                            assert.ok(actualQuery.started_at);
                            assert.ok(actualQuery.ended_at);
                        });
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be "done"'));
                    }
                });
            }, 50);
        });
    });

    describe('should report start and end time for each query also for failing queries', function () {
        var jobResponse;
        before(function(done) {
            createJob({
                "query": {
                    "query": [
                        {
                            "query": "SELECT * FROM untitle_table_4 limit 1",
                            "onerror": "SELECT * FROM untitle_table_4 limit 2"
                        },
                        {
                            "query": "SELECT * FROM untitle_table_4 limit 3 failed",
                            "onerror": "SELECT * FROM untitle_table_4 limit 4"
                        }
                    ],
                    "onerror": "SELECT * FROM untitle_table_4 limit 5"
                }
            }, function(err, job) {
                jobResponse = job;
                return done(err);
            });
        });

        it('should expose started_at and ended_at for all queries with fallback mechanism (failed)', function (done) {
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

            var interval = setInterval(function () {
                getJobStatus(jobResponse.job_id, function(err, job) {
                    if (job.status === jobStatus.FAILED) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        job.query.query.forEach(function(actualQuery) {
                            assert.ok(actualQuery.started_at);
                            assert.ok(actualQuery.ended_at);
                        });
                        done();
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be "failed"'));
                    }
                });
            }, 50);
        });
    });
});
