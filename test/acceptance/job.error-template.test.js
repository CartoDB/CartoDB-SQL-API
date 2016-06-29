require('../helper');

var assert = require('../support/assert');
var app = require(global.settings.app_root + '/app/app')();
var querystring = require('qs');
var metadataBackend = require('cartodb-redis')({
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
});
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

    var batch = batchFactory(metadataBackend);

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
                            "query": "create table batch_errors (error_message text)"
                        },
                        {
                            "query": "SELECT * FROM invalid_table",
                            "onerror": "INSERT INTO batch_errors values ('<%= error_message %>')"
                        }
                    ]
                }
            }, function(err, job) {
                jobResponse = job;
                return done(err);
            });
        });

        it('should keep the original templated query but use the error message', function (done) {
            var expectedQuery = {
                query: [
                    {
                        "query": "create table batch_errors (error_message text)",
                        status: 'done'
                    },
                    {
                        "query": "SELECT * FROM invalid_table",
                        "onerror": "INSERT INTO batch_errors values ('<%= error_message %>')",
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
                        getQueryResult('select * from batch_errors', function(err, result) {
                            if (err) {
                                return done(err);
                            }
                            assert.equal(result.rows[0].error_message, 'relation "invalid_table" does not exist');
                            getQueryResult('drop table batch_errors', done);
                        });
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be "failed"'));
                    }
                });
            }, 50);
        });
    });

});
