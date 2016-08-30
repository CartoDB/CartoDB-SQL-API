'use strict';

require('../../helper');

var BATCH_SOURCE = '../../../batch/';

var assert = require('../../support/assert');
var redisUtils = require('../../support/redis_utils');
var _ = require('underscore');
var RedisPool = require('redis-mpool');

var UserIndexer = require(BATCH_SOURCE + 'user_indexer');
var JobQueue = require(BATCH_SOURCE + 'job_queue');
var JobBackend = require(BATCH_SOURCE + 'job_backend');
var JobPublisher = require(BATCH_SOURCE + 'job_publisher');
var JobFactory = require(BATCH_SOURCE + 'models/job_factory');
var jobStatus = require(BATCH_SOURCE + 'job_status');

var redisConfig = {
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
};

var metadataBackend = require('cartodb-redis')(redisConfig);
var redisPoolPublisher = new RedisPool(_.extend(redisConfig, { name: 'batch-publisher'}));
var jobPublisher = new JobPublisher(redisPoolPublisher);
var jobQueue =  new JobQueue(metadataBackend, jobPublisher);
var userIndexer = new UserIndexer(metadataBackend);

var USER = 'vizzuality';
var QUERY = 'select pg_sleep(0)';
var HOST = 'localhost';
var JOB = {
    user: USER,
    query: QUERY,
    host: HOST
};

function createWadusJob() {
    return JobFactory.create(JSON.parse(JSON.stringify(JOB)));
}

describe('job backend', function() {
    var jobBackend = new JobBackend(metadataBackend, jobQueue, userIndexer);

    after(function (done) {
        redisUtils.clean('batch:*', done);
    });

    it('.create() should persist a job', function (done) {
        var job = createWadusJob();

        jobBackend.create(job.data, function (err, jobCreated) {
            if (err) {
                return done(err);
            }

            assert.ok(jobCreated.job_id);
            assert.equal(jobCreated.status, jobStatus.PENDING);
            done();
        });
    });

    it('.create() should return error', function (done) {
        var job = createWadusJob();

        delete job.data.job_id;

        jobBackend.create(job, function (err) {
            assert.ok(err);
            assert.equal(err.name, 'NotFoundError');
            assert.equal(err.message, 'Job with id undefined not found');
            done();
        });
    });

    it('.update() should update an existent job', function (done) {
        var job = createWadusJob();

        jobBackend.create(job.data, function (err, jobCreated) {
            if (err) {
                return done(err);
            }

            jobCreated.query = 'select pg_sleep(1)';

            var job = JobFactory.create(jobCreated);

            jobBackend.update(job.data, function (err, jobUpdated) {
                if (err) {
                    return done(err);
                }

                assert.equal(jobUpdated.query, 'select pg_sleep(1)');
                done();
            });
        });
    });

    it('.update() should return error when updates a nonexistent job', function (done) {
        var job = createWadusJob();

        jobBackend.update(job.data, function (err) {
            assert.ok(err, err);
            assert.equal(err.name, 'NotFoundError');
            assert.equal(err.message, 'Job with id ' + job.data.job_id + ' not found');
            done();
        });
    });
});
