var _ = require('underscore');
var queue = require('queue-async');
var Batch = require('../../batch/batch');
var JobPublisher = require('../../batch/job_publisher');
var JobQueueProducer = require('../../batch/job_queue_producer');
var JobBackend = require('../../batch/job_backend');
var metadataBackend = require('cartodb-redis')({
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
});

describe('batch', function() {
    var dbInstance = 'localhost';
    var username = 'vizzuality';
    var jobQueueProducer =  new JobQueueProducer(metadataBackend);
    var jobPublisher = new JobPublisher();
    var jobBackend = new JobBackend(metadataBackend);
    var batch = new Batch(metadataBackend);

    before(function () {
        batch.start();
    });

    after(function () {
        batch.stop();
    });

    function createJob(sql, done) {
        jobBackend.create(username, sql, function (err, job) {
            if (err) {
                return done(err);
            }

            jobQueueProducer.enqueue(job.jobId, dbInstance, function (err) {
                if (err) {
                    return done(err);
                }

                jobPublisher.publish(dbInstance);
                done(null, job);
            });
        });
    }

    it('should perform job with select', function (done) {
        createJob('select * from private_table', function (err, job) {
            if (err) {
                return done(err);
            }

            batch.on('job:done', function (jobId) {
                if (jobId === job.jobId) {
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

            batch.on('job:done', function (jobId) {
                if (jobId === job.jobId) {
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

            batch.on('job:done', function (jobId) {
                if (jobId === job.jobId) {
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

            batch.on('job:done', function (jobId) {
                _.find(jobsCreated, function(job) {
                    if (jobId === job.jobId) {
                        jobsDone += 1;
                        if (jobsDone === jobs.length) {
                            done();
                        }
                    }
                });
            });
        });
    });
});
