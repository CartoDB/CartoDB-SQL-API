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
var PSQL = require('cartodb-psql');

var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var jobPublisher = new JobPublisher(redisUtils.getPool());
var jobQueue =  new JobQueue(metadataBackend, jobPublisher);
var jobBackend = new JobBackend(metadataBackend, jobQueue);
var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
var jobCanceller = new JobCanceller(userDatabaseMetadataService);

var USER = 'vizzuality';
var QUERY = 'select pg_sleep(0)';
var HOST = 'localhost';
var JOB = {
    user: USER,
    query: QUERY,
    host: HOST
};

function createWadusDataJob() {
    return JSON.parse(JSON.stringify(JOB));
}

// sets job to running, run its query and returns inmediatly (don't wait for query finishes)
// in order to test query cancelation/draining
function runQueryHelper(job, callback) {
    var job_id = job.job_id;
    var user = job.user;
    var sql = job.query;

    job.status = jobStatus.RUNNING;

    jobBackend.update(job, function (err) {
        if (err) {
            return callback(err);
        }

        userDatabaseMetadataService.getUserMetadata(user, function (err, userDatabaseMetadata) {
            if (err) {
                return callback(err);
            }

            var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });

            sql = '/* ' + job_id + ' */ ' + sql;

            pg.eventedQuery(sql, function (err, query) {
                if (err) {
                    return callback(err);
                }

                callback(null, query);
            });
        });
    });
}

describe('job service', function() {
    var jobService = new JobService(jobBackend, jobCanceller);

    after(function (done) {
        redisUtils.clean('batch:*', done);
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

                assert.equal(job.data.job_id, jobCreated.data.job_id);
                done();
            });
        });
    });

    it('.get() should return a not found error', function (done) {
        jobService.get('wadus_job_id', function (err) {
            assert.ok(err);
            assert.equal(err.message, 'Job with id wadus_job_id not found');
            done();
        });
    });

    it('.create() should persist a job', function (done) {
        jobService.create(createWadusDataJob(), function (err, jobCreated) {
            if (err) {
                return done(err);
            }

            assert.ok(jobCreated.data.job_id);
            assert.equal(jobCreated.data.status, jobStatus.PENDING);
            done();
        });
    });

    it('.create() should return error with invalid job data', function (done) {
        var job = createWadusDataJob();

        delete job.query;

        jobService.create(job, function (err) {
            assert.ok(err);
            assert.equal(err.message, 'You must indicate a valid SQL');
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

                    assert.equal(jobCancelled.data.job_id, job.data.job_id);
                    assert.equal(jobCancelled.data.status, jobStatus.CANCELLED);
                    done();
                });
            });
        });
    });

    it('.cancel() should return a job not found error', function (done) {
        jobService.cancel('wadus_job_id', function (err) {
            assert.ok(err, err);
            assert.equal(err.name, 'NotFoundError');
            assert.equal(err.message, 'Job with id wadus_job_id not found');
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

                    assert.equal(jobDrained.job_id, job.data.job_id);
                    assert.equal(jobDrained.status, jobStatus.PENDING);
                    done();
                });
            });
        });
    });

    it('.drain() should return a job not found error', function (done) {
        jobService.drain('wadus_job_id', function (err) {
            assert.ok(err, err);
            assert.equal(err.name, 'NotFoundError');
            assert.equal(err.message, 'Job with id wadus_job_id not found');
            done();
        });
    });

});
