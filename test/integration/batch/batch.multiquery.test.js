    'use strict';

require('../../helper');
var assert = require('../../support/assert');
var queue = require('queue-async');

var redisConfig = {
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
};

var metadataBackend = require('cartodb-redis')(redisConfig);
var StatsD = require('node-statsd').StatsD;
var statsdClient = new StatsD(global.settings.statsd);

var BATCH_SOURCE = '../../../batch/';
var batchFactory = require(BATCH_SOURCE + 'index');


var _ = require('underscore');
var RedisPool = require('redis-mpool');
var jobStatus = require(BATCH_SOURCE + 'job_status');
var JobPublisher = require(BATCH_SOURCE + 'job_publisher');
var JobQueue = require(BATCH_SOURCE + 'job_queue');
var UserIndexer = require(BATCH_SOURCE + 'user_indexer');
var JobBackend = require(BATCH_SOURCE + 'job_backend');
var JobService = require(BATCH_SOURCE + 'job_service');
var UserDatabaseMetadataService = require(BATCH_SOURCE + 'user_database_metadata_service');
var JobCanceller = require(BATCH_SOURCE + 'job_canceller');

var redisPoolPublisher = new RedisPool(_.extend(redisConfig, { name: 'batch-publisher'}));
var jobPublisher = new JobPublisher(redisPoolPublisher);
var jobQueue =  new JobQueue(metadataBackend, jobPublisher);
var userIndexer = new UserIndexer(metadataBackend);
var jobBackend = new JobBackend(metadataBackend, jobQueue, userIndexer);
var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
var jobCanceller = new JobCanceller(userDatabaseMetadataService);
var jobService = new JobService(jobBackend, jobCanceller);

var USER = 'vizzuality';
var HOST = 'localhost';

var batch = batchFactory(metadataBackend, redisConfig, statsdClient);

function createJob(query, done) {
    var data = {
        user: USER,
        query: query,
        host: HOST
    };

    jobService.create(data, function (err, job) {
        if (err) {
            return done(err);
        }

        done(null, job.serialize());
    });
}

function getJob(job_id, callback) {
    jobService.get(job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        callback(null, job.serialize());
    });
}

function assertJob(job, expectedStatus, done) {
    return function (job_id) {
        if (job.job_id === job_id) {
            getJob(job_id, function (err, jobDone) {
                if (err) {
                    return done(err);
                }

                assert.equal(jobDone.status, expectedStatus);
                done();
            });
        }
    };
}

describe('batch multiquery', function() {

    beforeEach(function () {
        batch.start();
    });

    afterEach(function (done) {
        batch.stop();
        batch.removeAllListeners();
        batch.drain(function () {
            metadataBackend.redisCmd(5, 'DEL', [ 'batch:queues:localhost' ], done);
        });
    });

    it('should perform one multiquery job with two queries', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select pg_sleep(0)'
        ];

        createJob(queries, function (err, job) {
            if (err) {
                return done(err);
            }

            batch.on('job:done', assertJob(job, jobStatus.DONE, done));
        });
    });

    it('should perform one multiquery job with two queries and fail on last one', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select shouldFail()'
        ];

        createJob(queries, function (err, job) {
            if (err) {
                return done(err);
            }

            batch.on('job:failed', assertJob(job, jobStatus.FAILED, done));
        });
    });

    it('should perform one multiquery job with three queries and fail on last one', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select pg_sleep(0)',
            'select shouldFail()'
        ];

        createJob(queries, function (err, job) {
            if (err) {
                return done(err);
            }

            batch.on('job:failed', assertJob(job, jobStatus.FAILED, done));
        });
    });


    it('should perform one multiquery job with three queries and fail on second one', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select shouldFail()',
            'select pg_sleep(0)'
        ];

        createJob(queries, function (err, job) {
            if (err) {
                return done(err);
            }

            batch.on('job:failed', assertJob(job, jobStatus.FAILED, done));
        });
    });

    it('should perform two multiquery job with two queries for each one', function (done) {
        var jobs = [[
            'select pg_sleep(0)',
            'select pg_sleep(0)'
        ], [
            'select pg_sleep(0)',
            'select pg_sleep(0)'
        ]];

        var jobsQueue = queue(jobs.length);

        jobs.forEach(function(job) {
            jobsQueue.defer(createJob, job);
        });

        jobsQueue.awaitAll(function (err, jobs) {
            if (err) {
                return done(err);
            }

            jobs.forEach(function (job) {
                batch.on('job:done', assertJob(job, jobStatus.DONE, done));
            });
        });
    });

    it('should perform two multiquery job with two queries for each one and fail the first one', function (done) {
        var jobs = [[
            'select pg_sleep(0)',
            'select shouldFail()'
        ], [
            'select pg_sleep(0)',
            'select pg_sleep(0)'
        ]];

        queue(jobs.length)
            .defer(createJob, jobs[0])
            .defer(createJob, jobs[1])
            .awaitAll(function (err, createdJobs) {
                if (err) {
                    return done(err);
                }

                queue(createdJobs.length)
                    .defer(function (callback) {
                        batch.on('job:failed', assertJob(createdJobs[0], jobStatus.FAILED, callback));
                    })
                    .defer(function (callback) {
                        batch.on('job:done', assertJob(createdJobs[1], jobStatus.DONE, callback));
                    })
                    .awaitAll(done);
            });
    });

    it('should perform two multiquery job with two queries for each one and fail the second one', function (done) {
        var jobs = [[
            'select pg_sleep(0)',
            'select pg_sleep(0)'
        ], [
            'select pg_sleep(0)',
            'select shouldFail()',
        ]];

        queue(jobs.length)
            .defer(createJob, jobs[0])
            .defer(createJob, jobs[1])
            .awaitAll(function (err, createdJobs) {
                if (err) {
                    return done(err);
                }

                queue(createdJobs.length)
                    .defer(function (callback) {
                        batch.on('job:done', assertJob(createdJobs[0], jobStatus.DONE, callback));
                    })
                    .defer(function (callback) {
                        batch.on('job:failed', assertJob(createdJobs[1], jobStatus.FAILED, callback));
                    })
                    .awaitAll(done);
            });
    });

});
