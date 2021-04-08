'use strict';

require('../../helper');

var BATCH_SOURCE = '../../../lib/batch/';

var assert = require('../../support/assert');
var redisUtils = require('../../support/redis-utils');

var Logger = require('../../../lib/utils/logger');
var JobQueue = require(BATCH_SOURCE + 'job-queue');
var JobBackend = require(BATCH_SOURCE + 'job-backend');
var JobPublisher = require(BATCH_SOURCE + 'pubsub/job-publisher');
var JobFactory = require(BATCH_SOURCE + 'models/job-factory');
var jobStatus = require(BATCH_SOURCE + 'job-status');

var logger = new Logger();
var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var jobPublisher = new JobPublisher(redisUtils.getPool());
var jobQueue = new JobQueue(metadataBackend, jobPublisher, logger);

var queue = require('queue-async');

var USER = 'vizzuality';
var QUERY = 'select pg_sleep(0)';
var HOST = 'localhost';
var JOB = {
    user: USER,
    query: QUERY,
    host: HOST
};

function createWadusJob () {
    return JobFactory.create(JSON.parse(JSON.stringify(JOB)));
}

describe('job backend', function () {
    var jobBackend = new JobBackend(metadataBackend, jobQueue, logger);

    after(function (done) {
        redisUtils.clean(global.settings.batch_db, 'batch:*', done);
    });

    it('.create() should persist a job', function (done) {
        var job = createWadusJob();

        jobBackend.create(job.data, function (err, jobCreated) {
            if (err) {
                return done(err);
            }

            assert.ok(jobCreated.job_id);
            assert.strictEqual(jobCreated.status, jobStatus.PENDING);
            done();
        });
    });

    it('.create() should return error', function (done) {
        var job = createWadusJob();

        delete job.data.job_id;

        jobBackend.create(job.data, function (err) {
            assert.ok(err);
            assert.strictEqual(err.name, 'NotFoundError');
            assert.strictEqual(err.message, 'Job with id undefined not found');
            done();
        });
    });

    it('.get() should return a job with the given id', function (done) {
        var jobData = createWadusJob();

        jobBackend.create(jobData.data, function (err, jobCreated) {
            if (err) {
                return done(err);
            }

            assert.ok(jobCreated.job_id);

            jobBackend.get(jobCreated.job_id, function (err, job) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(job.job_id, jobCreated.job_id);
                assert.strictEqual(job.user, jobData.data.user);
                assert.strictEqual(job.query, jobData.data.query);
                assert.strictEqual(job.host, jobData.data.host);
                assert.strictEqual(job.status, jobStatus.PENDING);
                done();
            });
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

                assert.strictEqual(jobUpdated.query, 'select pg_sleep(1)');
                done();
            });
        });
    });

    it('.update() should return error when updates a nonexistent job', function (done) {
        var job = createWadusJob();

        jobBackend.update(job.data, function (err) {
            assert.ok(err, err);
            assert.strictEqual(err.name, 'NotFoundError');
            assert.strictEqual(err.message, 'Job with id ' + job.data.job_id + ' not found');
            done();
        });
    });

    it('.save() should save a job', function (done) {
        var job = createWadusJob();

        jobBackend.save(job.data, function (err, jobSaved) {
            if (err) {
                return done(err);
            }

            assert.ok(jobSaved.job_id);

            assert.strictEqual(jobSaved.user, job.data.user);
            assert.strictEqual(jobSaved.query, job.data.query);
            assert.strictEqual(jobSaved.host, job.data.host);
            assert.strictEqual(jobSaved.status, jobStatus.PENDING);
            done();
        });
    });

    it('.addWorkInProgressJob() should add current job to user and host lists', function (done) {
        var job = createWadusJob();

        jobBackend.addWorkInProgressJob(job.data.user, job.data.job_id, function (err) {
            if (err) {
                return done(err);
            }
            done();
        });
    });

    it('.listWorkInProgressJobByUser() should retrieve WIP jobs of given user', function (done) {
        var testStepsQueue = queue(1);

        testStepsQueue.defer(redisUtils.clean, global.settings.batch_db, 'batch:wip:user:*');
        testStepsQueue.defer(jobBackend.addWorkInProgressJob.bind(jobBackend), 'vizzuality', 'wadus');
        testStepsQueue.defer(jobBackend.listWorkInProgressJobByUser.bind(jobBackend), 'vizzuality');

        testStepsQueue.awaitAll(function (err, results) {
            if (err) {
                return done(err);
            }
            assert.deepStrictEqual(results[2], ['wadus']);
            done();
        });
    });

    it('.listWorkInProgressJobs() should retrieve WIP users', function (done) {
        var jobs = [{ user: 'userA', id: 'jobId1' }, { user: 'userA', id: 'jobId2' }, { user: 'userB', id: 'jobId3' }];

        var testStepsQueue = queue(1);

        jobs.forEach(function (job) {
            testStepsQueue.defer(jobBackend.addWorkInProgressJob.bind(jobBackend), job.user, job.id);
        });

        testStepsQueue.awaitAll(function (err) {
            if (err) {
                done(err);
            }

            jobBackend.listWorkInProgressJobs(function (err, users) {
                if (err) {
                    return done(err);
                }

                assert.ok(users.userA);
                assert.deepStrictEqual(users.userA, ['jobId1', 'jobId2']);
                assert.ok(users.userB);
                assert.deepStrictEqual(users.userB, ['jobId3']);
                done();
            });
        });
    });

    it('.clearWorkInProgressJob() should remove job from work in progress list', function (done) {
        var job = createWadusJob();

        jobBackend.addWorkInProgressJob(job.data.user, job.data.job_id, function (err) {
            if (err) {
                return done(err);
            }

            jobBackend.clearWorkInProgressJob(job.data.user, job.data.job_id, function (err) {
                if (err) {
                    return done(err);
                }

                done();
            });
        });
    });
});
