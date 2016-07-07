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

describe('Batch API fallback job', function () {

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

    describe('"onsuccess" on first query should be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                        }]
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 1",
                    "status": "done",
                    "fallback_status": "done"
                }]
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                    }
                });
            }, 50);
        });
    });

    describe('"onerror" on first query should not be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4",
                            onerror: "SELECT * FROM untitle_table_4 limit 1"
                        }]
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done){
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4",
                    "onerror": "SELECT * FROM untitle_table_4 limit 1",
                    "status": "done",
                    "fallback_status": "skipped"
                }]
            };
            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                    }
                });
            }, 50);
        });
    });

    describe('"onerror" on first query should be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM nonexistent_table /* query should fail */",
                            onerror: "SELECT * FROM untitle_table_4 limit 1"
                        }]
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done){
            var expectedQuery = {
                query: [{
                    query: 'SELECT * FROM nonexistent_table /* query should fail */',
                    onerror: 'SELECT * FROM untitle_table_4 limit 1',
                    status: 'failed',
                    fallback_status: 'done',
                    failed_reason: 'relation "nonexistent_table" does not exist'
                }]
            };
            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.FAILED) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                    }
                });
            }, 50);
        });
    });

    describe('"onsuccess" on first query should not be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM nonexistent_table /* query should fail */",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                        }]
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be failed', function (done){
            var expectedQuery = {
                query: [{
                    query: 'SELECT * FROM nonexistent_table /* query should fail */',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 1',
                    status: 'failed',
                    fallback_status: 'skipped',
                    failed_reason: 'relation "nonexistent_table" does not exist'
                }]
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.FAILED) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be failed'));
                    }
                });
            }, 50);
        });
    });


    describe('"onsuccess" should be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4",
                        }],
                        onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4",
                    "status": "done"
                }],
                "onsuccess": "SELECT * FROM untitle_table_4 limit 1"
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.DONE && job.fallback_status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                    }
                });
            }, 50);
        });
    });

    describe('"onsuccess" should not be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM nonexistent_table /* query should fail */",
                        }],
                        onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                query: [{
                    query: 'SELECT * FROM nonexistent_table /* query should fail */',
                    status: 'failed',
                    failed_reason: 'relation "nonexistent_table" does not exist'
                }],
                onsuccess: 'SELECT * FROM untitle_table_4 limit 1'
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.FAILED && job.fallback_status === jobStatus.SKIPPED) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be pending'));
                    }
                });
            }, 50);
        });
    });


    describe('"onerror" should be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM nonexistent_table /* query should fail */"
                        }],
                        onerror: "SELECT * FROM untitle_table_4 limit 1"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM nonexistent_table /* query should fail */",
                    "status": "failed",
                    "failed_reason": 'relation "nonexistent_table" does not exist'
                }],
                "onerror": "SELECT * FROM untitle_table_4 limit 1"
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.FAILED && job.fallback_status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be failed'));
                    }
                });
            }, 50);
        });
    });

    describe('"onerror" should not be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4",
                        }],
                        onerror: "SELECT * FROM untitle_table_4 limit 1"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4",
                    "status": "done"
                }],
                "onerror": "SELECT * FROM untitle_table_4 limit 1"
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.DONE && job.fallback_status === jobStatus.SKIPPED) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                    }
                });
            }, 50);
        });
    });


    describe('"onsuccess" & "onsuccess" on query should be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                        }],
                        onsuccess: "SELECT * FROM untitle_table_4 limit 2"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 1",
                    "status": "done",
                    "fallback_status": "done"
                }],
                "onsuccess": "SELECT * FROM untitle_table_4 limit 2"
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.DONE && job.fallback_status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                    }
                });
            }, 50);
        });
    });

    describe('"onsuccess" for each query should be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                        }, {
                            query: "SELECT * FROM untitle_table_4 limit 2",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 3"
                        }]
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 1",
                    "status": "done",
                    "fallback_status": "done"
                }, {
                    "query": "SELECT * FROM untitle_table_4 limit 2",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 3",
                    "status": "done",
                    "fallback_status": "done"
                }]
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                    }
                });
            }, 50);
        });
    });

    describe('"onsuccess" for each query should not be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM nonexistent_table /* should fail */",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                        }, {
                            query: "SELECT * FROM untitle_table_4 limit 2",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 3"
                        }]
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be failed', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM nonexistent_table /* should fail */",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 1",
                    "status": "failed",
                    "fallback_status": "skipped",
                    "failed_reason": 'relation "nonexistent_table" does not exist'
                }, {
                    "query": "SELECT * FROM untitle_table_4 limit 2",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 3",
                    "status": "skipped",
                    "fallback_status": "skipped"
                }]
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.FAILED) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be failed'));
                    }
                });
            }, 50);
        });
    });


    describe('"onsuccess" for second query should not be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4 limit 2",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                        }, {
                            query: "SELECT * FROM nonexistent_table /* should fail */",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 3"
                        }]
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be failed', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4 limit 2",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 1",
                    "status": "done",
                    "fallback_status": "done"
                }, {
                    "query": "SELECT * FROM nonexistent_table /* should fail */",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 3",
                    "status": "failed",
                    "fallback_status": "skipped",
                    "failed_reason": 'relation "nonexistent_table" does not exist'
                }]
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.FAILED) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be failed'));
                    }
                });
            }, 50);
        });
    });

    describe('"onerror" should not be triggered for any query and "skipped"', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4 limit 1",
                            onerror: "SELECT * FROM untitle_table_4 limit 2"
                        }, {
                            query: "SELECT * FROM untitle_table_4 limit 3",
                            onerror: "SELECT * FROM untitle_table_4 limit 4"
                        }]
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be failed', function (done) {
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

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                    }
                });
            }, 50);
        });
    });

    describe('"onsuccess" should be "skipped"', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4 limit 1, /* should fail */",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 2"
                        }]
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be failed', function (done) {
            var expectedQuery = {
                query: [{
                    query: 'SELECT * FROM untitle_table_4 limit 1, /* should fail */',
                    onsuccess: 'SELECT * FROM untitle_table_4 limit 2',
                    status: 'failed',
                    fallback_status: 'skipped',
                    failed_reason: 'syntax error at end of input'
                }]
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.FAILED) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be failed'));
                    }
                });
            }, 50);
        });
    });


    describe('"onsuccess" should not be triggered and "skipped"', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4 limit 1, /* should fail */",
                        }],
                        onsuccess: "SELECT * FROM untitle_table_4 limit 2"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be failed', function (done) {
            var expectedQuery = {
                query: [{
                    query: 'SELECT * FROM untitle_table_4 limit 1, /* should fail */',
                    status: 'failed',
                    failed_reason: 'syntax error at end of input'
                }],
                onsuccess: 'SELECT * FROM untitle_table_4 limit 2'
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.FAILED && job.fallback_status === jobStatus.SKIPPED) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be failed'));
                    }
                });
            }, 50);
        });
    });

    describe('"onsuccess" for first query should fail', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4 limit 1",
                            onsuccess: "SELECT * FROM nonexistent_table /* should fail */"
                        }, {
                            query: "SELECT * FROM untitle_table_4 limit 2",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 3"
                        }]
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4 limit 1",
                    "onsuccess": "SELECT * FROM nonexistent_table /* should fail */",
                    "status": "done",
                    "fallback_status": "failed",
                    "failed_reason": 'relation "nonexistent_table" does not exist'
                }, {
                    "query": "SELECT * FROM untitle_table_4 limit 2",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 3",
                    "status": "done",
                    "fallback_status": "done"
                }]
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                    }
                });
            }, 50);
        });
    });

    describe('"onsuccess" for second query should fail', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4 limit 1",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 2"
                        }, {
                            query: "SELECT * FROM untitle_table_4 limit 3",
                            onsuccess: "SELECT * FROM nonexistent_table /* should fail */"
                        }]
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4 limit 1",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 2",
                    "status": "done",
                    "fallback_status": "done"
                }, {
                    "query": "SELECT * FROM untitle_table_4 limit 3",
                    "onsuccess": "SELECT * FROM nonexistent_table /* should fail */",
                    "status": "done",
                    "fallback_status": "failed",
                    "failed_reason": 'relation "nonexistent_table" does not exist'
                }]
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                    }
                });
            }, 50);
        });
    });

    describe('"onsuccess" for job & "onsuccess" for each query should be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4 limit 1",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 2"
                        }, {
                            query: "SELECT * FROM untitle_table_4 limit 3",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 4"
                        }],
                        onsuccess: "SELECT * FROM untitle_table_4 limit 5"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4 limit 1",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 2",
                    "status": "done",
                    "fallback_status": "done"
                }, {
                    "query": "SELECT * FROM untitle_table_4 limit 3",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 4",
                    "status": "done",
                    "fallback_status": "done"
                }],
                onsuccess: "SELECT * FROM untitle_table_4 limit 5"
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.DONE && job.fallback_status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                    }
                });
            }, 50);
        });
    });

    describe('"onsuccess" for job & "onsuccess" for each query should be triggered ' +
    '(even second "onsuccess" fails job should be done)', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4 limit 1",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 2"
                        }, {
                            query: "SELECT * FROM untitle_table_4 limit 3",
                            onsuccess: "SELECT * FROM nonexistent_table /* should fail */"
                        }],
                        onsuccess: "SELECT * FROM untitle_table_4 limit 5"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4 limit 1",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 2",
                    "status": "done",
                    "fallback_status": "done"
                }, {
                    "query": "SELECT * FROM untitle_table_4 limit 3",
                    "onsuccess": "SELECT * FROM nonexistent_table /* should fail */",
                    "status": "done",
                    "fallback_status": "failed",
                    "failed_reason": 'relation "nonexistent_table" does not exist'
                }],
                "onsuccess": "SELECT * FROM untitle_table_4 limit 5"
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.DONE && job.fallback_status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be done'));
                    }
                });
            }, 50);
        });
    });

    describe('"onsuccess" for job & "onsuccess" for each query should not be triggered ' +
    ' because it has been cancelled', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT pg_sleep(3)",
                            onsuccess: "SELECT pg_sleep(0)"
                        }],
                        onsuccess: "SELECT pg_sleep(0)"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should be running', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT pg_sleep(3)",
                    "onsuccess": "SELECT pg_sleep(0)",
                    "status": "running",
                    "fallback_status": "pending"
                }],
                "onsuccess": "SELECT pg_sleep(0)"
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.RUNNING && job.fallback_status === jobStatus.PENDING) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.DONE ||
                            job.status === jobStatus.FAILED ||
                            job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                    }
                });
            }, 50);
        });

        it('job should be cancelled', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT pg_sleep(3)",
                    "onsuccess": "SELECT pg_sleep(0)",
                    "status": "cancelled",
                    "fallback_status": "skipped"
                }],
                "onsuccess": "SELECT pg_sleep(0)"
            };

            assert.response(app, {
                url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'DELETE'
            }, {
                status: 200
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                var job = JSON.parse(res.body);
                if (job.status === jobStatus.CANCELLED && job.fallback_status === jobStatus.SKIPPED) {
                    validateExpectedResponse(job.query, expectedQuery);
                    done();
                } else if (job.status === jobStatus.DONE || job.status === jobStatus.FAILED) {
                    done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be cancelled'));
                }
            });
        });
    });

    describe('first "onsuccess" should be triggered and it will be cancelled', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: {
                        query: [{
                            query: "SELECT pg_sleep(0)",
                            onsuccess: "SELECT pg_sleep(3)"
                        }],
                        onsuccess: "SELECT pg_sleep(0)"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job "onsuccess" should be running', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT pg_sleep(0)",
                    "onsuccess": "SELECT pg_sleep(3)",
                    "status": "done",
                    "fallback_status": "running"
                }],
                "onsuccess": "SELECT pg_sleep(0)"
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.query.query[0].status === jobStatus.DONE &&
                        job.query.query[0].fallback_status === jobStatus.RUNNING) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.query.query[0].status === jobStatus.DONE ||
                            job.query.query[0].status === jobStatus.FAILED ||
                            job.query.query[0].status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' +
                            job.query.query[0].status +
                            ', expected to be running'));
                    }
                });
            }, 50);
        });

        it('job should be cancelled', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT pg_sleep(0)",
                    "onsuccess": "SELECT pg_sleep(3)",
                    "status": "done",
                    "fallback_status": "cancelled"
                }],
                "onsuccess": "SELECT pg_sleep(0)"
            };

            assert.response(app, {
                url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'DELETE'
            }, {
                status: 200
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                var job = JSON.parse(res.body);
                if (job.status === jobStatus.CANCELLED && job.fallback_status === jobStatus.SKIPPED) {
                    validateExpectedResponse(job.query, expectedQuery);
                    done();
                } else if (job.status === jobStatus.DONE || job.status === jobStatus.FAILED) {
                    done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be cancelled'));
                }
            });
        });
    });

    describe('should fail first "onerror" and job "onerror" and skip the other ones', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    "query": {
                        "query": [{
                            "query": "SELECT * FROM atm_madrid limit 1, should fail",
                            "onerror": "SELECT * FROM atm_madrid limit 2"
                        }, {
                            "query": "SELECT * FROM atm_madrid limit 3",
                            "onerror": "SELECT * FROM atm_madrid limit 4"
                        }],
                        "onerror": "SELECT * FROM atm_madrid limit 5"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should fail', function (done) {
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

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.FAILED && job.fallback_status === jobStatus.FAILED) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be failed'));
                    }
                });
            }, 50);
        });
    });

    describe('should run first "onerror" and job "onerror" and skip the other ones', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            assert.response(app, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'host': 'vizzuality.cartodb.com'
                },
                method: 'POST',
                data: querystring.stringify({
                    "query": {
                        "query": [{
                            "query": "SELECT * FROM untitle_table_4 limit 1, should fail",
                            "onerror": "SELECT * FROM untitle_table_4 limit 2"
                        }, {
                            "query": "SELECT * FROM untitle_table_4 limit 3",
                            "onerror": "SELECT * FROM untitle_table_4 limit 4"
                        }],
                        "onerror": "SELECT * FROM untitle_table_4 limit 5"
                    }
                })
            }, {
                status: 201
            }, function (res, err) {
                if (err) {
                    return done(err);
                }
                fallbackJob = JSON.parse(res.body);
                done();
            });
        });

        it('job should fail', function (done) {
            var expectedQuery = {
                "query": [
                  {
                    "query": "SELECT * FROM untitle_table_4 limit 1, should fail",
                    "onerror": "SELECT * FROM untitle_table_4 limit 2",
                    "status": "failed",
                    "fallback_status": "done",
                    "failed_reason": "LIMIT #,# syntax is not supported"
                  },
                  {
                    "query": "SELECT * FROM untitle_table_4 limit 3",
                    "onerror": "SELECT * FROM untitle_table_4 limit 4",
                    "status": "skipped",
                    "fallback_status": "skipped"
                  }
                ],
                "onerror": "SELECT * FROM untitle_table_4 limit 5"
            };

            var interval = setInterval(function () {
                assert.response(app, {
                    url: '/api/v2/sql/job/' + fallbackJob.job_id + '?api_key=1234&',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'host': 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {
                    status: 200
                }, function (res, err) {
                    if (err) {
                        return done(err);
                    }
                    var job = JSON.parse(res.body);
                    if (job.status === jobStatus.FAILED && job.fallback_status === jobStatus.DONE) {
                        clearInterval(interval);
                        validateExpectedResponse(job.query, expectedQuery);
                        done();
                    } else if (job.status === jobStatus.DONE || job.status === jobStatus.CANCELLED) {
                        clearInterval(interval);
                        done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be failed'));
                    }
                });
            }, 50);
        });
    });
});
