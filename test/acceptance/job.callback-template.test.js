require('../helper');

var assert = require('../support/assert');
var redisUtils = require('../support/redis_utils');
var app = require(global.settings.app_root + '/app/app')();
var querystring = require('qs');
var metadataBackend = require('cartodb-redis')(redisUtils.getConfig());
var batchFactory = require('../../batch');
var jobStatus = require('../../batch/job_status');

describe('Batch API callback templates', function () {

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

    function getQueryResult(query, callback) {
        assert.response(app, {
            url: '/api/v2/sql?' + querystring.stringify({q: query, api_key: 1234}),
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
                assert.equal(
                    actualQuery[expectedKey],
                    expectedQuery[expectedKey],
                    'Expected value for key "' + expectedKey + '" does not match: ' + actualQuery[expectedKey] + ' ==' +
                    expectedQuery[expectedKey] + ' at query index=' + index + '. Full response: ' +
                    JSON.stringify(actual, null, 4)
                );
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

    var batch = batchFactory(metadataBackend, redisUtils.getConfig());

    before(function (done) {
        batch.start();
        batch.on('ready', done);
    });

    after(function (done) {
        batch.stop();
        redisUtils.clean('batch:*', done);
    });

    describe.skip('should use templates for error_message and job_id onerror callback', function () {
        var jobResponse;
        before(function(done) {
            getQueryResult('create table test_batch_errors (job_id text, error_message text)', function(err) {
                if (err) {
                    return done(err);
                }
                createJob({
                    "query": {
                        "query": [
                            {
                                "query": "SELECT * FROM invalid_table",
                                "onerror": "INSERT INTO test_batch_errors " +
                                    "values ('<%= job_id %>', '<%= error_message %>')"
                            }
                        ]
                    }
                }, function(err, job) {
                    jobResponse = job;
                    return done(err);
                });
            });
        });

        it('should keep the original templated query but use the error message', function (done) {
            var expectedQuery = {
                query: [
                    {
                        "query": "SELECT * FROM invalid_table",
                        "onerror": "INSERT INTO test_batch_errors values ('<%= job_id %>', '<%= error_message %>')",
                        status: 'failed',
                        fallback_status: 'done'
                    }
                ]
            };

            var interval = setInterval(function () {
                getJobStatus(jobResponse.job_id, function(err, job) {
                    if (job.status === jobStatus.FAILED) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        getQueryResult('select * from test_batch_errors', function(err, result) {
                            if (err) {
                                return done(err);
                            }
                            assert.equal(result.rows[0].job_id, jobResponse.job_id);
                            assert.equal(result.rows[0].error_message, 'relation "invalid_table" does not exist');
                            getQueryResult('drop table test_batch_errors', done);
                        });
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be "failed"'));
                    }
                });
            }, 50);
        });
    });

    describe('should use template for job_id onsuccess callback', function () {
        var jobResponse;
        before(function(done) {
            createJob({
                "query": {
                    "query": [
                        {
                            query: "create table batch_jobs (job_id text)"
                        },
                        {
                            "query": "SELECT 1",
                            "onsuccess": "INSERT INTO batch_jobs values ('<%= job_id %>')"
                        }
                    ]
                }
            }, function(err, job) {
                jobResponse = job;
                return done(err);
            });
        });

        it('should keep the original templated query but use the job_id', function (done) {
            var expectedQuery = {
                query: [
                    {
                        query: "create table batch_jobs (job_id text)",
                        status: 'done'
                    },
                    {
                        query: "SELECT 1",
                        onsuccess: "INSERT INTO batch_jobs values ('<%= job_id %>')",
                        status: 'done',
                        fallback_status: 'done'
                    }
                ]
            };

            var interval = setInterval(function () {
                getJobStatus(jobResponse.job_id, function(err, job) {
                    if (job.status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        getQueryResult('select * from batch_jobs', function(err, result) {
                            if (err) {
                                return done(err);
                            }
                            assert.equal(result.rows[0].job_id, jobResponse.job_id);
                            getQueryResult('drop table batch_jobs', done);
                        });
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be "done"'));
                    }
                });
            }, 50);
        });
    });

});
