require('../../helper');
var assert = require('../../support/assert');
var redisUtils = require('../../support/redis_utils');
var batchFactory = require('../../../batch/index');

var JobPublisher = require('../../../batch/pubsub/job-publisher');
var JobQueue = require('../../../batch/job_queue');
var JobBackend = require('../../../batch/job_backend');
var JobService = require('../../../batch/job_service');
var UserDatabaseMetadataService = require('../../../batch/user_database_metadata_service');
var JobCanceller = require('../../../batch/job_canceller');
var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });

describe('batch module', function() {
    var dbInstance = 'localhost';
    var username = 'vizzuality';
    var pool = redisUtils.getPool();
    var jobPublisher = new JobPublisher(pool);
    var jobQueue =  new JobQueue(metadataBackend, jobPublisher);
    var jobBackend = new JobBackend(metadataBackend, jobQueue);
    var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
    var jobCanceller = new JobCanceller(userDatabaseMetadataService);
    var jobService = new JobService(jobBackend, jobCanceller);

    before(function (done) {
        this.batch = batchFactory(metadataBackend, pool);
        this.batch.start();
        this.batch.on('ready', done);
    });

    after(function (done) {
        this.batch.stop();
        redisUtils.clean('batch:*', done);
    });

    function createJob(sql, done) {
        var data = {
            user: username,
            query: sql,
            host: dbInstance
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
