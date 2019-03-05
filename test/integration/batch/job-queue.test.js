'use strict';

require('../../helper');
var assert = require('../../support/assert');
var redisUtils = require('../../support/redis_utils');

var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var JobPublisher = require('../../../batch/pubsub/job-publisher');
var JobQueue = require('../../../batch/job_queue');

var JobBackend = require('../../../batch/job_backend');
var JobService = require('../../../batch/job_service');
var JobCanceller = require('../../../batch/job_canceller');
var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });

describe('job queue', function () {
    var pool = redisUtils.getPool();
    var jobPublisher = new JobPublisher(pool);
    var jobQueue =  new JobQueue(metadataBackend, jobPublisher);
    var jobBackend = new JobBackend(metadataBackend, jobQueue);
    var jobCanceller = new JobCanceller();
    var jobService = new JobService(jobBackend, jobCanceller);

    var userA = 'userA';
    var userB = 'userB';

    beforeEach(function () {
        this.jobQueue = new JobQueue(metadataBackend, jobPublisher);
    });

    afterEach(function (done) {
        redisUtils.clean('batch:*', done);
    });

    it('should find queues for one user', function (done) {
        var self = this;

        this.jobQueue.enqueue(userA, 'wadus-wadus-wadus-wadus', function(err) {
            if (err) {
                return done(err);
            }

            self.jobQueue.scanQueues(function (err, queues) {
                assert.ifError(err);
                assert.equal(queues.length, 1);
                assert.equal(queues[0], userA);
                return done();
            });
        });
    });

    it('should find queues for more than one user', function (done) {
        var self = this;

        this.jobQueue.enqueue(userA, 'wadus-wadus-wadus-wadus', function(err) {
            if (err) {
                return done(err);
            }
            self.jobQueue.enqueue(userB, 'wadus-wadus-wadus-wadus', function(err) {
                if (err) {
                    return done(err);
                }

                self.jobQueue.scanQueues(function (err, queues) {
                    assert.ifError(err);
                    assert.equal(queues.length, 2);
                    assert.ok(queues[0] === userA || queues[0] === userB);
                    assert.ok(queues[1] === userA || queues[1] === userB);

                    return done();
                });
            });
        });
    });

    it('should find queues from jobs not using new Redis SETs for users', function(done) {
        var self = this;
        var redisArgs = [JobQueue.QUEUE.PREFIX + userA, 'wadus-id'];
        metadataBackend.redisCmd(JobQueue.QUEUE.DB, 'LPUSH', redisArgs, function (err) {
            assert.ok(!err, err);
            self.jobQueue.scanQueues(function (err, queues) {
                assert.ok(!err, err);

                assert.equal(queues.length, 1);
                assert.equal(queues[0], userA);

                return done();
            });
        });
    });

    it('.scanQueues() should feed queue index', function (done) {
        var self = this;

        var data = {
            user: 'vizzuality',
            query: 'select 1 as cartodb_id',
            host: 'localhost'
        };

        jobService.create(data, function (err) {
            if (err) {
                return done(err);
            }

            self.jobQueue.scanQueues(function (err, queuesFromScan) {
                if (err) {
                    return done(err);
                }

                assert.equal(queuesFromScan.length, 1);
                assert.ok(queuesFromScan.indexOf(data.user) >= 0);

                self.jobQueue.getQueues(function (err, queuesFromIndex) {
                    if (err) {
                        done(err);
                    }

                    assert.equal(queuesFromIndex.length, 1);
                    assert.ok(queuesFromIndex.indexOf(data.user) >= 0);

                    redisUtils.clean('batch:*', done);
                });

            });
        });
    });

    it('.scanQueues() should feed queue index with two users', function (done) {
        var self = this;

        var jobVizzuality = {
            user: 'vizzuality',
            query: 'select 1 as cartodb_id',
            host: 'localhost'
        };

        var jobWadus = {
            user: 'wadus',
            query: 'select 1 as cartodb_id',
            host: 'localhost'
        };

        jobService.create(jobVizzuality, function (err) {
            if (err) {
                return done(err);
            }

            jobService.create(jobWadus, function (err) {
                if (err) {
                    return done(err);
                }

                self.jobQueue.scanQueues(function (err, queuesFromScan) {
                    if (err) {
                        return done(err);
                    }

                    assert.equal(queuesFromScan.length, 2);
                    assert.ok(queuesFromScan.indexOf(jobVizzuality.user) >= 0);
                    assert.ok(queuesFromScan.indexOf(jobWadus.user) >= 0);

                    self.jobQueue.getQueues(function (err, queuesFromIndex) {
                        if (err) {
                            done(err);
                        }

                        assert.equal(queuesFromIndex.length, 2);
                        assert.ok(queuesFromIndex.indexOf(jobVizzuality.user) >= 0);
                        assert.ok(queuesFromIndex.indexOf(jobWadus.user) >= 0);

                        redisUtils.clean('batch:*', done);
                    });

                });
            });
        });
    });
});
