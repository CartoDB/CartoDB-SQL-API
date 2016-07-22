    'use strict';

require('../../helper');
var assert = require('../../support/assert');
var redisUtils = require('../../support/redis_utils');
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
var JobFactory = require(BATCH_SOURCE + 'models/job_factory');

var redisPoolPublisher = new RedisPool(_.extend(redisConfig, { name: 'batch-publisher'}));
var jobPublisher = new JobPublisher(redisPoolPublisher);
var jobQueue =  new JobQueue(metadataBackend, jobPublisher);
var userIndexer = new UserIndexer(metadataBackend);
var jobBackend = new JobBackend(metadataBackend, jobQueue, userIndexer);

var USER = 'vizzuality';
var HOST = 'localhost';

function createJob(job) {
    jobBackend.create(job, function () {});
}

function getJob(job_id, callback) {
    jobBackend.get(job_id, function (err, job) {
        if (err) {
            return callback(err);
        }

        callback(null, job);
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
    var batch = batchFactory(metadataBackend, redisConfig, statsdClient);

    before(function (done) {
        batch.start();
        batch.on('ready', done);
    });

    after(function (done) {
        batch.removeAllListeners();
        batch.stop();
        redisUtils.clean('batch:*', done);
    });

    it('should perform one multiquery job with two queries', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select pg_sleep(0)'
        ];

        var job = JobFactory.create({ user: USER, host: HOST, query: queries});
        var assertCallback = assertJob(job.data, jobStatus.DONE, done);

        batch.on('job:done', assertCallback);

        createJob(job.data);
    });

    it('should perform one multiquery job with two queries and fail on last one', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select shouldFail()'
        ];

        var job = JobFactory.create({ user: USER, host: HOST, query: queries});
        var assertCallback = assertJob(job.data, jobStatus.FAILED, done);

        batch.on('job:failed', assertCallback);

        createJob(job.data);
    });

    it('should perform one multiquery job with three queries and fail on last one', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select pg_sleep(0)',
            'select shouldFail()'
        ];

        var job = JobFactory.create({ user: USER, host: HOST, query: queries});
        var assertCallback = assertJob(job.data, jobStatus.FAILED, done);

        batch.on('job:failed', assertCallback);

        createJob(job.data);
    });


    it('should perform one multiquery job with three queries and fail on second one', function (done) {
        var queries = [
            'select pg_sleep(0)',
            'select shouldFail()',
            'select pg_sleep(0)'
        ];

        var job = JobFactory.create({ user: USER, host: HOST, query: queries});
        var assertCallback = assertJob(job.data, jobStatus.FAILED, done);

        batch.on('job:failed', assertCallback);

        createJob(job.data);
    });

    it('should perform two multiquery job with two queries for each one', function (done) {
        var jobs = [];

        jobs.push(JobFactory.create({ user: USER, host: HOST, query: [
            'select pg_sleep(0)',
            'select pg_sleep(0)'
        ]}));

        jobs.push(JobFactory.create({ user: USER, host: HOST, query: [
            'select pg_sleep(0)',
            'select pg_sleep(0)'
        ]}));

        var jobsQueue = queue(jobs.length);

        jobs.forEach(function (job) {
            jobsQueue.defer(function (callback) {
                batch.on('job:done', assertJob(job.data, jobStatus.DONE, callback));
                createJob(job.data);
            });
        });

        jobsQueue.awaitAll(done);
    });

    it('should perform two multiquery job with two queries for each one and fail the first one', function (done) {
        var jobs = [];

        jobs.push(JobFactory.create({ user: USER, host: HOST, query: [
            'select pg_sleep(0)',
            'select shouldFail()'
        ]}));

        jobs.push(JobFactory.create({ user: USER, host: HOST, query: [
            'select pg_sleep(0)',
            'select pg_sleep(0)'
        ]}));

        var jobsQueue = queue(jobs.length);

        jobsQueue.defer(function (callback) {
            batch.on('job:failed', assertJob(jobs[0].data, jobStatus.FAILED, callback));
            createJob(jobs[0].data);
        });

        jobsQueue.defer(function (callback) {
            batch.on('job:done', assertJob(jobs[1].data, jobStatus.DONE, callback));
            createJob(jobs[1].data);
        });

        jobsQueue.awaitAll(done);
    });

    it('should perform two multiquery job with two queries for each one and fail the second one', function (done) {
        var jobs = [];

        jobs.push(JobFactory.create({ user: USER, host: HOST, query: [
            'select pg_sleep(0)',
            'select pg_sleep(0)'
        ]}));

        jobs.push(JobFactory.create({ user: USER, host: HOST, query: [
            'select pg_sleep(0)',
            'select shouldFail()'
        ]}));

        var jobsQueue = queue(jobs.length);

        jobsQueue.defer(function (callback) {
            batch.on('job:done', assertJob(jobs[0].data, jobStatus.DONE, callback));
            createJob(jobs[0].data);
        });

        jobsQueue.defer(function (callback) {
            batch.on('job:failed', assertJob(jobs[1].data, jobStatus.FAILED, callback));
            createJob(jobs[1].data);
        });

        jobsQueue.awaitAll(done);
    });
});
