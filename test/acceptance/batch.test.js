var assert = require('../support/assert');
var redisUtils = require('../support/redis_utils');
var _ = require('underscore');
var RedisPool = require('redis-mpool');
var queue = require('queue-async');
var batchFactory = require('../../batch');

var JobPublisher = require('../../batch/job_publisher');
var JobQueue = require('../../batch/job_queue');
var UserIndexer = require('../../batch/user_indexer');
var JobBackend = require('../../batch/job_backend');
var JobService = require('../../batch/job_service');
var UserDatabaseMetadataService = require('../../batch/user_database_metadata_service');
var JobCanceller = require('../../batch/job_canceller');
var metadataBackend = require('cartodb-redis')(redisUtils.getConfig());

describe('batch module', function() {
    var dbInstance = 'localhost';
    var username = 'vizzuality';
    var redisPoolPublisher = new RedisPool(_.extend(redisUtils.getConfig(), { name: 'batch-publisher'}));
    var jobPublisher = new JobPublisher(redisPoolPublisher);
    var jobQueue =  new JobQueue(metadataBackend, jobPublisher);
    var userIndexer = new UserIndexer(metadataBackend);
    var jobBackend = new JobBackend(metadataBackend, jobQueue, userIndexer);
    var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
    var jobCanceller = new JobCanceller(userDatabaseMetadataService);
    var jobService = new JobService(jobBackend, jobCanceller);

    var batch = batchFactory(metadataBackend, redisUtils.getConfig());

    before(function (done) {
        batch.start();
        batch.on('ready', done);
    });

    after(function (done) {
        batch.stop();
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

    it('should perform all enqueued jobs', function (done) {
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

    it('should perform job with array of select', function (done) {
        var queries = ['select * from private_table limit 1', 'select * from private_table'];

        createJob(queries, function (err, job) {
            if (err) {
                return done(err);
            }

            var queriesDone = 0;

            var checkJobDone = function (job_id) {
                if (job_id === job.job_id) {
                    queriesDone += 1;
                    if (queriesDone === queries.length) {
                        done();
                    }
                }
            };

            batch.on('job:done', checkJobDone);
            batch.on('job:pending', checkJobDone);
        });
    });

    it('should set job as failed if last query fails', function (done) {
        var queries = ['select * from private_table', 'select * from undefined_table'];

        createJob(queries, function (err, job) {
            if (err) {
                return done(err);
            }

            batch.on('job:failed', function (job_id) {
                if (job_id === job.job_id) {
                    done();
                }
            });
        });
    });

    it('should set job as failed if first query fails', function (done) {
        var queries = ['select * from undefined_table', 'select * from private_table'];

        createJob(queries, function (err, job) {
            if (err) {
                return done(err);
            }

            batch.on('job:failed', function (job_id) {
                if (job_id === job.job_id) {
                    done();
                }
            });
        });
    });

});
