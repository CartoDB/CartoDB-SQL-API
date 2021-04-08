'use strict';

require('../../helper');
var assert = require('../../support/assert');
var redisUtils = require('../../support/redis-utils');
var batchFactory = require('../../../lib/batch/index');

var Logger = require('../../../lib/utils/logger');
var JobPublisher = require('../../../lib/batch/pubsub/job-publisher');
var JobQueue = require('../../../lib/batch/job-queue');
var JobBackend = require('../../../lib/batch/job-backend');
var JobService = require('../../../lib/batch/job-service');
var JobCanceller = require('../../../lib/batch/job-canceller');
var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });

const TEST_USER_ID = 1;
const TEST_USER = global.settings.db_user.replace('<%= user_id %>', TEST_USER_ID);
const TEST_DB = global.settings.db_base_name.replace('<%= user_id %>', TEST_USER_ID);

describe('batch module', function () {
    var username = 'vizzuality';
    var pool = redisUtils.getPool();
    var logger = new Logger();
    var jobPublisher = new JobPublisher(pool);
    var jobQueue = new JobQueue(metadataBackend, jobPublisher, logger);
    var jobBackend = new JobBackend(metadataBackend, jobQueue, logger);
    var jobCanceller = new JobCanceller();
    var jobService = new JobService(jobBackend, jobCanceller, logger);

    before(function (done) {
        this.batch = batchFactory(metadataBackend, pool, undefined, undefined, logger);
        this.batch.start();
        this.batch.on('ready', done);
    });

    after(function (done) {
        this.batch.stop();
        redisUtils.clean(global.settings.batch_db, 'batch:*', done);
    });

    function createJob (sql, done) {
        var data = {
            user: username,
            query: sql,
            host: global.settings.db_host,
            dbname: TEST_DB,
            dbuser: TEST_USER,
            port: global.settings.db_batch_port,
            pass: global.settings.db_user_pass
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
                    assert.strictEqual(job.status, 'running');

                    self.batch.drain(function () {
                        jobBackend.get(job.job_id, function (err, job) {
                            if (err) {
                                done(err);
                            }
                            assert.strictEqual(job.status, 'pending');
                            done();
                        });
                    });
                });
            }, 50);
        });
    });
});
