var assert = require('../support/assert');
var _ = require('underscore');
var redis = require('redis');
var queue = require('queue-async');
var batchFactory = require('../../batch');
var JobPublisher = require('../../batch/job_publisher');
var JobQueue = require('../../batch/job_queue');
var UserIndexer = require('../../batch/user_indexer');
var JobBackend = require('../../batch/job_backend');
var metadataBackend = require('cartodb-redis')({
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
});

describe('batch module', function() {
    var dbInstance = 'localhost';
    var username = 'vizzuality';
    var jobQueue =  new JobQueue(metadataBackend);
    var jobPublisher = new JobPublisher(redis);
    var userIndexer = new UserIndexer(metadataBackend);
    var jobBackend = new JobBackend(metadataBackend, jobQueue, jobPublisher, userIndexer);

    var batch = batchFactory(metadataBackend);

    before(function () {
        batch.start();
    });

    after(function (done) {
        batch.stop();
        batch.drain(done);
    });

    function createJob(sql, done) {
        jobBackend.create(username, sql, dbInstance, function (err, job) {
            if (err) {
                return done(err);
            }

            done(null, job);
        });
    }

    it('should perform job with select', function (done) {
        createJob('select * from private_table', function (err, job) {
            if (err) {
                return done(err);
            }

            batch.on('job:done', function (job_id) {
                if (job_id === job.job_id) {
                    done();
                }
            });
        });
    });

    it('should perform job with select into', function (done) {
        createJob('select * into batch_test_table from (select * from private_table) as job', function (err, job) {
            if (err) {
                return done(err);
            }

            batch.on('job:done', function (job_id) {
                if (job_id === job.job_id) {
                    done();
                }
            });
        });
    });

    it('should perform job swith select from result table', function (done) {
        createJob('select * from batch_test_table', function (err, job) {
            if (err) {
                return done(err);
            }

            batch.on('job:done', function (job_id) {
                if (job_id === job.job_id) {
                    done();
                }
            });
        });
    });

    it('should perform all job enqueued', function (done) {
        var jobs = [
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table',
            'select * from private_table'
        ];

        var jobsQueue = queue(jobs.length);

        jobs.forEach(function(job) {
            jobsQueue.defer(createJob, job);
        });

        jobsQueue.awaitAll(function (err, jobsCreated) {
            if (err) {
                return done(err);
            }

            var jobsDone = 0;

            batch.on('job:done', function (job_id) {
                _.find(jobsCreated, function(job) {
                    if (job_id === job.job_id) {
                        jobsDone += 1;
                        if (jobsDone === jobs.length) {
                            done();
                        }
                    }
                });
            });
        });
    });

    it('should set all job as failed', function (done) {
        var jobs = [
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table',
            'select * from unexistent_table'
        ];

        var jobsQueue = queue(jobs.length);

        jobs.forEach(function(job) {
            jobsQueue.defer(createJob, job);
        });

        jobsQueue.awaitAll(function (err, jobsCreated) {
            if (err) {
                return done(err);
            }

            var jobsFailed = 0;

            batch.on('job:failed', function (job_id) {
                _.find(jobsCreated, function(job) {
                    if (job_id === job.job_id) {
                        jobsFailed += 1;
                        if (jobsFailed === jobs.length) {
                            done();
                        }
                    }
                });
            });
        });
    });

    it('should drain the current job', function (done) {
        createJob('select pg_sleep(30)', function (err, job) {
            if (err) {
                return done(err);
            }
            setTimeout(function () {
                jobBackend.get(job.job_id, function (err, job) {
                    if (err) {
                        done(err);
                    }

                    assert.equal(job.status, 'running');

                    batch.drain(function () {
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
