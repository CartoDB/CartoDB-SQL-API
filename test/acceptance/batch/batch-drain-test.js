'use strict';

require('../../helper');
var assert = require('../../support/assert');
var redisUtils = require('../../support/redis-utils');
var batchFactory = require('../../../lib/batch/index');

var BatchLogger = require('../../../lib/batch/batch-logger');
var JobPublisher = require('../../../lib/batch/pubsub/job-publisher');
var JobQueue = require('../../../lib/batch/job-queue');
var JobBackend = require('../../../lib/batch/job-backend');
var JobService = require('../../../lib/batch/job-service');
var JobCanceller = require('../../../lib/batch/job-canceller');
var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });

describe('batch module', function () {
    var dbInstance = 'localhost';
    var username = 'vizzuality';
    var pool = redisUtils.getPool();
    var logger = new BatchLogger(null, 'batch-queries');
    var jobPublisher = new JobPublisher(pool);
    var jobQueue = new JobQueue(metadataBackend, jobPublisher, logger);
    var jobBackend = new JobBackend(metadataBackend, jobQueue, logger);
    var jobCanceller = new JobCanceller();
    var jobService = new JobService(jobBackend, jobCanceller, logger);

    before(function (done) {
        this.batch = batchFactory(metadataBackend, pool);
        this.batch.start();
        this.batch.on('ready', done);
    });

    after(function (done) {
        this.batch.stop();
        redisUtils.clean('batch:*', done);
    });

    function createJob (sql, done) {
        var data = {
            user: username,
            query: sql,
            host: dbInstance,
            dbname: 'cartodb_test_user_1_db',
            dbuser: 'test_cartodb_user_1',
            port: 5432,
            pass: 'test_cartodb_user_1_pass'
        };

        jobService.create(data, function (err, job) {
            if (err) {
                return done(err);
            }

            done(null, job.serialize());
        });
    }

    it('should drain the current job', function (done) {
        var self = this;
        createJob('select pg_sleep(3)', function (err, job) {
            if (err) {
                return done(err);
            }
            setTimeout(function () {
                jobBackend.get(job.job_id, function (err, job) {
                    if (err) {
                        done(err);
                    }
                    assert.equal(job.status, 'running');

                    self.batch.drain(function () {
                        jobBackend.get(job.job_id, function (err, job) {
                            if (err) {
                                done(err);
                            }
                            assert.equal(job.status, 'pending');
                            done();
                        });
                    });
                });
            }, 50);
        });
    });
});
