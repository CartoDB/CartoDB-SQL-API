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
var JobCanceller = require(BATCH_SOURCE + 'job-canceller');
var JobService = require(BATCH_SOURCE + 'job-service');
var PSQL = require('cartodb-psql');

var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var logger = new Logger();
var jobPublisher = new JobPublisher(redisUtils.getPool());
var jobQueue = new JobQueue(metadataBackend, jobPublisher, logger);
var jobBackend = new JobBackend(metadataBackend, jobQueue, logger);
var jobCanceller = new JobCanceller();

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

function createWadusDataJob () {
    return JSON.parse(JSON.stringify(JOB));
}

// sets job to running, run its query and returns inmediatly (don't wait for query finishes)
// in order to test query cancelation/draining
function runQueryHelper (job, callback) {
    var jobId = job.job_id;
    var sql = job.query;

    job.status = jobStatus.RUNNING;

    jobBackend.update(job, function (err) {
        if (err) {
            return callback(err);
        }

        const dbConfiguration = {
            host: job.host,
            port: job.port,
            dbname: job.dbname,
            user: job.dbuser,
            pass: job.pass
        };

        var pg = new PSQL(dbConfiguration);

        sql = '/* ' + jobId + ' */ ' + sql;

        pg.eventedQuery(sql, function (err, query) {
            if (err) {
                return callback(err);
            }

            callback(null, query);
        });
    });
}

describe('job service', function () {
    var jobService = new JobService(jobBackend, jobCanceller);

    after(function (done) {
        redisUtils.clean(global.settings.batch_db, 'batch:*', done);
    });

    it('.get() should return a job', function (done) {
        jobService.create(createWadusDataJob(), function (err, jobCreated) {
            if (err) {
                return done(err);
            }

            jobService.get(jobCreated.data.job_id, function (err, job) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(job.data.job_id, jobCreated.data.job_id);
                done();
            });
        });
    });

    it('.get() should return a not found error', function (done) {
        jobService.get('wadus_job_id', function (err) {
            assert.ok(err);
            assert.strictEqual(err.message, 'Job with id wadus_job_id not found');
            done();
        });
    });

    it('.create() should persist a job', function (done) {
        jobService.create(createWadusDataJob(), function (err, jobCreated) {
            if (err) {
                return done(err);
            }

            assert.ok(jobCreated.data.job_id);
            assert.strictEqual(jobCreated.data.status, jobStatus.PENDING);
            done();
        });
    });

    it('.create() should return error with invalid job data', function (done) {
        var job = createWadusDataJob();

        delete job.query;

        jobService.create(job, function (err) {
            assert.ok(err);
            assert.strictEqual(err.message, 'You must indicate a valid SQL');
            done();
        });
    });

    it('.cancel() should cancel a running job', function (done) {
        var job = createWadusDataJob();
        job.query = 'select pg_sleep(3)';

        jobService.create(job, function (err, job) {
            if (err) {
                return done(err);
            }

            runQueryHelper(job.data, function (err) {
                if (err) {
                    return done(err);
                }

                jobService.cancel(job.data.job_id, function (err, jobCancelled) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(jobCancelled.data.job_id, job.data.job_id);
                    assert.strictEqual(jobCancelled.data.status, jobStatus.CANCELLED);
                    done();
                });
            });
        });
    });

    it('.cancel() should return a job not found error', function (done) {
        jobService.cancel('wadus_job_id', function (err) {
            assert.ok(err, err);
            assert.strictEqual(err.name, 'NotFoundError');
            assert.strictEqual(err.message, 'Job with id wadus_job_id not found');
            done();
        });
    });

    it('.drain() should draing a running job', function (done) {
        var job = createWadusDataJob();
        job.query = 'select pg_sleep(3)';

        jobService.create(job, function (err, job) {
            if (err) {
                return done(err);
            }

            runQueryHelper(job.data, function (err) {
                if (err) {
                    return done(err);
                }

                jobService.drain(job.data.job_id, function (err, jobDrained) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(jobDrained.job_id, job.data.job_id);
                    assert.strictEqual(jobDrained.status, jobStatus.PENDING);
                    done();
                });
            });
        });
    });

    it('.drain() should return a job not found error', function (done) {
        jobService.drain('wadus_job_id', function (err) {
            assert.ok(err, err);
            assert.strictEqual(err.name, 'NotFoundError');
            assert.strictEqual(err.message, 'Job with id wadus_job_id not found');
            done();
        });
    });
});
