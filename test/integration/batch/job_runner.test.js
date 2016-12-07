'use strict';

require('../../helper');

var BATCH_SOURCE = '../../../batch/';

var assert = require('../../support/assert');
var redisUtils = require('../../support/redis_utils');

var JobQueue = require(BATCH_SOURCE + 'job_queue');
var JobBackend = require(BATCH_SOURCE + 'job_backend');
var JobPublisher = require(BATCH_SOURCE + 'pubsub/job-publisher');
var jobStatus = require(BATCH_SOURCE + 'job_status');
var UserDatabaseMetadataService = require(BATCH_SOURCE + 'user_database_metadata_service');
var JobCanceller = require(BATCH_SOURCE + 'job_canceller');
var JobService = require(BATCH_SOURCE + 'job_service');
var JobRunner = require(BATCH_SOURCE + 'job_runner');
var QueryRunner = require(BATCH_SOURCE + 'query_runner');


var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var jobPublisher = new JobPublisher(redisUtils.getPool());
var jobQueue =  new JobQueue(metadataBackend, jobPublisher);
var jobBackend = new JobBackend(metadataBackend, jobQueue);
var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
var jobCanceller = new JobCanceller(userDatabaseMetadataService);
var jobService = new JobService(jobBackend, jobCanceller);
var queryRunner = new QueryRunner(userDatabaseMetadataService);
var StatsD = require('node-statsd').StatsD;
var statsdClient = new StatsD(global.settings.statsd);

var USER = 'vizzuality';
var QUERY = 'select pg_sleep(0)';
var HOST = 'localhost';
var JOB = {
    user: USER,
    query: QUERY,
    host: HOST
};

describe('job runner', function() {
    var jobRunner = new JobRunner(jobService, jobQueue, queryRunner, metadataBackend, statsdClient);

    after(function (done) {
        redisUtils.clean('batch:*', function() {
            redisUtils.clean('limits:batch:*', done);
        });
    });

    it('.run() should run a job', function (done) {
        jobService.create(JOB, function (err, job) {
            if (err) {
                return done(err);
            }

            jobRunner.run(job.data.job_id, function (err, job) {
                if (err) {
                    return done(err);
                }

                assert.equal(job.data.status, jobStatus.DONE);
                done();
            });
        });
    });

    it('.run() should return a job not found error', function (done) {
        jobRunner.run('wadus_job_id', function (err) {
            assert.ok(err, err);
            assert.equal(err.name, 'NotFoundError');
            assert.equal(err.message, 'Job with id wadus_job_id not found');
            done();
        });
    });

});
