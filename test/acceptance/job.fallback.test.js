require('../helper');

var assert = require('assert');
var app = require(global.settings.app_root + '/app/app')();
// var assert = require('../support/assert');
var request = require('supertest');
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
            request(app)
                .post('/api/v2/sql/job')
                .query({ api_key: '1234' })
                .set('Content-Type', 'application/json')
                .set('host', 'vizzuality.cartodb.com')
                .send({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                        }]
                    }
                })
                .expect(201)
                .end(function (err, res) {
                    fallbackJob = res.body;
                    done(err);
                });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 1",
                    "status": ["done", "done"]
                }]
            };

            var interval = setInterval(function () {
                request(app)
                    .get('/api/v2/sql/job/' + fallbackJob.job_id)
                    .query({ api_key: '1234' })
                    .set('Content-Type', 'application/json')
                    .set('host', 'vizzuality.cartodb.com')
                    .expect(200)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }
                        var job = res.body;
                        if (job.status === jobStatus.DONE) {
                            clearInterval(interval);
                            assert.deepEqual(job.query, expectedQuery);
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
            request(app)
                .post('/api/v2/sql/job')
                .query({ api_key: '1234' })
                .set('Content-Type', 'application/json')
                .set('host', 'vizzuality.cartodb.com')
                .send({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4",
                            onerror: "SELECT * FROM untitle_table_4 limit 1"
                        }]
                    }
                })
                .expect(201)
                .end(function (err, res) {
                    fallbackJob = res.body;
                    done(err);
                });
        });

        it('job should be done', function (done){
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4",
                    "onerror": "SELECT * FROM untitle_table_4 limit 1",
                    "status": ["done", "pending"]
                }]
            };
            var interval = setInterval(function () {
                request(app)
                    .get('/api/v2/sql/job/' + fallbackJob.job_id)
                    .query({ api_key: '1234' })
                    .set('Content-Type', 'application/json')
                    .set('host', 'vizzuality.cartodb.com')
                    .expect(200)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }
                        var job = res.body;
                        if (job.status === jobStatus.DONE) {
                            clearInterval(interval);
                            assert.deepEqual(job.query, expectedQuery);
                            done();
                        } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                            clearInterval(interval);
                            done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                        }
                    });
            }, 50);
        });
    });

    describe('"onerror" on first query should be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            request(app)
                .post('/api/v2/sql/job')
                .query({ api_key: '1234' })
                .set('Content-Type', 'application/json')
                .set('host', 'vizzuality.cartodb.com')
                .send({
                    query: {
                        query: [{
                            query: "SELECT * FROM unexistent_table /* query should fail */",
                            onerror: "SELECT * FROM untitle_table_4 limit 1"
                        }]
                    }
                })
                .expect(201)
                .end(function (err, res) {
                    fallbackJob = res.body;
                    done(err);
                });
        });

        it('job should be done', function (done){
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM unexistent_table /* query should fail */",
                    "onerror": "SELECT * FROM untitle_table_4 limit 1",
                    "status": ["failed", "done"]
                }]
            };
            var interval = setInterval(function () {
                request(app)
                    .get('/api/v2/sql/job/' + fallbackJob.job_id)
                    .query({ api_key: '1234' })
                    .set('Content-Type', 'application/json')
                    .set('host', 'vizzuality.cartodb.com')
                    .expect(200)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }
                        var job = res.body;
                        if (job.status === jobStatus.DONE) {
                            clearInterval(interval);
                            assert.deepEqual(job.query, expectedQuery);
                            done();
                        } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                            clearInterval(interval);
                            done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                        }
                    });
            }, 50);
        });
    });

    describe('"onsuccess" on first query should not be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            request(app)
                .post('/api/v2/sql/job')
                .query({ api_key: '1234' })
                .set('Content-Type', 'application/json')
                .set('host', 'vizzuality.cartodb.com')
                .send({
                    query: {
                        query: [{
                            query: "SELECT * FROM unexistent_table /* query should fail */",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                        }]
                    }
                })
                .expect(201)
                .end(function (err, res) {
                    fallbackJob = res.body;
                    done(err);
                });
        });

        it('job should be failed', function (done){
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM unexistent_table /* query should fail */",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 1",
                    "status": ["failed", "pending"]
                }]
            };

            var interval = setInterval(function () {
                request(app)
                    .get('/api/v2/sql/job/' + fallbackJob.job_id)
                    .query({ api_key: '1234' })
                    .set('Content-Type', 'application/json')
                    .set('host', 'vizzuality.cartodb.com')
                    .expect(200)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }
                        var job = res.body;
                        if (job.status === jobStatus.FAILED) {
                            clearInterval(interval);
                            assert.deepEqual(job.query, expectedQuery);
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
            request(app)
                .post('/api/v2/sql/job')
                .query({ api_key: '1234' })
                .set('Content-Type', 'application/json')
                .set('host', 'vizzuality.cartodb.com')
                .send({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4",
                        }],
                        onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                    }
                })
                .expect(201)
                .end(function (err, res) {
                    fallbackJob = res.body;
                    done(err);
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
                request(app)
                    .get('/api/v2/sql/job/' + fallbackJob.job_id)
                    .query({ api_key: '1234' })
                    .set('Content-Type', 'application/json')
                    .set('host', 'vizzuality.cartodb.com')
                    .expect(200)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }
                        var job = res.body;
                        if (job.status[0] === jobStatus.DONE && job.status[1] === jobStatus.DONE) {
                            clearInterval(interval);
                            assert.deepEqual(job.query, expectedQuery);
                            done();
                        } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                            clearInterval(interval);
                            done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                        }
                    });
            }, 50);
        });
    });

    describe('"onsuccess" should not be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            request(app)
                .post('/api/v2/sql/job')
                .query({ api_key: '1234' })
                .set('Content-Type', 'application/json')
                .set('host', 'vizzuality.cartodb.com')
                .send({
                    query: {
                        query: [{
                            query: "SELECT * FROM unexistent_table /* query should fail */",
                        }],
                        onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                    }
                })
                .expect(201)
                .end(function (err, res) {
                    fallbackJob = res.body;
                    done(err);
                });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM unexistent_table /* query should fail */",
                    "status": "failed"
                }],
                "onsuccess": "SELECT * FROM untitle_table_4 limit 1"
            };

            var interval = setInterval(function () {
                request(app)
                    .get('/api/v2/sql/job/' + fallbackJob.job_id)
                    .query({ api_key: '1234' })
                    .set('Content-Type', 'application/json')
                    .set('host', 'vizzuality.cartodb.com')
                    .expect(200)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }
                        var job = res.body;
                        if (job.status[0] === jobStatus.FAILED && job.status[1] === jobStatus.PENDING) {
                            clearInterval(interval);
                            assert.deepEqual(job.query, expectedQuery);
                            done();
                        } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                            clearInterval(interval);
                            done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                        }
                    });
            }, 50);
        });
    });


    describe('"onerror" should be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            request(app)
                .post('/api/v2/sql/job')
                .query({ api_key: '1234' })
                .set('Content-Type', 'application/json')
                .set('host', 'vizzuality.cartodb.com')
                .send({
                    query: {
                        query: [{
                            query: "SELECT * FROM unexistent_table /* query should fail */",
                        }],
                        onerror: "SELECT * FROM untitle_table_4 limit 1"
                    }
                })
                .expect(201)
                .end(function (err, res) {
                    fallbackJob = res.body;
                    done(err);
                });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM unexistent_table /* query should fail */",
                    "status": "failed"
                }],
                "onerror": "SELECT * FROM untitle_table_4 limit 1"
            };

            var interval = setInterval(function () {
                request(app)
                    .get('/api/v2/sql/job/' + fallbackJob.job_id)
                    .query({ api_key: '1234' })
                    .set('Content-Type', 'application/json')
                    .set('host', 'vizzuality.cartodb.com')
                    .expect(200)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }
                        var job = res.body;
                        if (job.status[0] === jobStatus.FAILED && job.status[1] === jobStatus.DONE) {
                            clearInterval(interval);
                            assert.deepEqual(job.query, expectedQuery);
                            done();
                        } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                            clearInterval(interval);
                            done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                        }
                    });
            }, 50);
        });
    });

    describe('"onerror" should not be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            request(app)
                .post('/api/v2/sql/job')
                .query({ api_key: '1234' })
                .set('Content-Type', 'application/json')
                .set('host', 'vizzuality.cartodb.com')
                .send({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4",
                        }],
                        onerror: "SELECT * FROM untitle_table_4 limit 1"
                    }
                })
                .expect(201)
                .end(function (err, res) {
                    fallbackJob = res.body;
                    done(err);
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
                request(app)
                    .get('/api/v2/sql/job/' + fallbackJob.job_id)
                    .query({ api_key: '1234' })
                    .set('Content-Type', 'application/json')
                    .set('host', 'vizzuality.cartodb.com')
                    .expect(200)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }
                        var job = res.body;
                        if (job.status[0] === jobStatus.DONE && job.status[1] === jobStatus.PENDING) {
                            clearInterval(interval);
                            assert.deepEqual(job.query, expectedQuery);
                            done();
                        } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                            clearInterval(interval);
                            done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                        }
                    });
            }, 50);
        });
    });


    describe('"onsuccess" & "onsucces" on query should be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            request(app)
                .post('/api/v2/sql/job')
                .query({ api_key: '1234' })
                .set('Content-Type', 'application/json')
                .set('host', 'vizzuality.cartodb.com')
                .send({
                    query: {
                        query: [{
                            query: "SELECT * FROM untitle_table_4",
                            onsuccess: "SELECT * FROM untitle_table_4 limit 1"
                        }],
                        onsuccess: "SELECT * FROM untitle_table_4 limit 2"
                    }
                })
                .expect(201)
                .end(function (err, res) {
                    fallbackJob = res.body;
                    done(err);
                });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 1",
                    "status": ["done", "done"]
                }],
                "onsuccess": "SELECT * FROM untitle_table_4 limit 2"
            };

            var interval = setInterval(function () {
                request(app)
                    .get('/api/v2/sql/job/' + fallbackJob.job_id)
                    .query({ api_key: '1234' })
                    .set('Content-Type', 'application/json')
                    .set('host', 'vizzuality.cartodb.com')
                    .expect(200)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }
                        var job = res.body;
                        if (job.status[0] === jobStatus.DONE && job.status[1] === jobStatus.DONE) {
                            clearInterval(interval);
                            assert.deepEqual(job.query, expectedQuery);
                            done();
                        } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                            clearInterval(interval);
                            done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                        }
                    });
            }, 50);
        });
    });

    describe('"onsuccess" for each query should be triggered', function () {
        var fallbackJob = {};

        it('should create a job', function (done) {
            request(app)
                .post('/api/v2/sql/job')
                .query({ api_key: '1234' })
                .set('Content-Type', 'application/json')
                .set('host', 'vizzuality.cartodb.com')
                .send({
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
                .expect(201)
                .end(function (err, res) {
                    fallbackJob = res.body;
                    done(err);
                });
        });

        it('job should be done', function (done) {
            var expectedQuery = {
                "query": [{
                    "query": "SELECT * FROM untitle_table_4",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 1",
                    "status": ["done", "done"]
                }, {
                    "query": "SELECT * FROM untitle_table_4 limit 2",
                    "onsuccess": "SELECT * FROM untitle_table_4 limit 3",
                    "status": ["done", "done"]
                }]
            };

            var interval = setInterval(function () {
                request(app)
                    .get('/api/v2/sql/job/' + fallbackJob.job_id)
                    .query({ api_key: '1234' })
                    .set('Content-Type', 'application/json')
                    .set('host', 'vizzuality.cartodb.com')
                    .expect(200)
                    .end(function (err, res) {
                        if (err) {
                            return done(err);
                        }
                        var job = res.body;
                        if (job.status === jobStatus.DONE) {
                            clearInterval(interval);
                            assert.deepEqual(job.query, expectedQuery);
                            done();
                        } else if (job.status === jobStatus.FAILED || job.status === jobStatus.CANCELLED) {
                            clearInterval(interval);
                            done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                        }
                    });
            }, 50);
        });
    });
});
