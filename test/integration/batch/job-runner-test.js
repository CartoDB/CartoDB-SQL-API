'use strict';

require('../../helper');

var BATCH_SOURCE = '../../../lib/batch/';

var assert = require('../../support/assert');
var redisUtils = require('../../support/redis-utils');

var Logger = require('../../../lib/utils/logger');
var JobQueue = require(BATCH_SOURCE + 'job-queue');
var JobBackend = require(BATCH_SOURCE + 'job-backend');
var JobPublisher = require(BATCH_SOURCE + 'pubsub/job-publisher');
var jobStatus = require(BATCH_SOURCE + 'job-status');
var UserDatabaseMetadataService = require(BATCH_SOURCE + 'user-database-metadata-service');
var JobCanceller = require(BATCH_SOURCE + 'job-canceller');
var JobService = require(BATCH_SOURCE + 'job-service');
var JobRunner = require(BATCH_SOURCE + 'job-runner');
var QueryRunner = require(BATCH_SOURCE + 'query-runner');

var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var logger = new Logger();
var jobPublisher = new JobPublisher(redisUtils.getPool());
var jobQueue = new JobQueue(metadataBackend, jobPublisher, logger);
var jobBackend = new JobBackend(metadataBackend, jobQueue, logger);
var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
var jobCanceller = new JobCanceller();
var jobService = new JobService(jobBackend, jobCanceller, logger);
var queryRunner = new QueryRunner(userDatabaseMetadataService, logger);
var StatsD = require('node-statsd').StatsD;
var statsdClient = new StatsD(global.settings.statsd);

const TEST_USER_ID = 1;
const TEST_USER = global.settings.db_user.replace('<%= user_id %>', TEST_USER_ID);
const TEST_DB = global.settings.db_base_name.replace('<%= user_id %>', TEST_USER_ID);

var USER = 'vizzuality';
var QUERY = 'select pg_sleep(0)';
var JOB = {
    user: USER,
    query: QUERY,
    host: global.settings.db_host,
    dbname: TEST_DB,
    dbuser: TEST_USER,
    port: global.settings.db_batch_port,
    pass: global.settings.db_user_pass
};

describe('job runner', function () {
    var jobRunner = new JobRunner(jobService, jobQueue, queryRunner, metadataBackend, statsdClient);

    after(function (done) {
        redisUtils.clean(global.settings.batch_db, 'batch:*', function () {
            redisUtils.clean(global.settings.batch_db, 'limits:batch:*', done);
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

                assert.strictEqual(job.data.status, jobStatus.DONE);
                done();
            });
        });
    });

    it('.run() should return a job not found error', function (done) {
        jobRunner.run('wadus_job_id', function (err) {
            assert.ok(err, err);
            assert.strictEqual(err.name, 'NotFoundError');
            assert.strictEqual(err.message, 'Job with id wadus_job_id not found');
            done();
        });
    });
});
