'use strict';

require('../../helper');
var assert = require('../../support/assert');
var redisUtils = require('../../support/redis_utils');

var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var JobPublisher = require('../../../batch/pubsub/job-publisher');
var QueueSeeker = require('../../../batch/pubsub/queue-seeker');
var JobQueue = require('../../../batch/job_queue');

var jobPublisher = new JobPublisher(redisUtils.getPool());


describe('queue seeker', function() {
    var userA = 'userA';
    var userB = 'userB';

    beforeEach(function () {
        this.jobQueue = new JobQueue(metadataBackend, jobPublisher);
    });

    afterEach(function (done) {
        redisUtils.clean('batch:*', done);
    });

    it('should find queues for one user', function (done) {
        var seeker = new QueueSeeker(redisUtils.getPool());
        this.jobQueue.enqueue(userA, 'wadus-wadus-wadus-wadus', function(err) {
            if (err) {
                return done(err);
            }
            seeker.seek(function(err, users) {
                assert.ok(!err);
                assert.equal(users.length, 1);
                assert.equal(users[0], userA);

                return done();
            });
        });
    });

    it('should find queues for more than one user', function (done) {
        var self = this;
        var seeker = new QueueSeeker(redisUtils.getPool());
        this.jobQueue.enqueue(userA, 'wadus-wadus-wadus-wadus', function(err) {
            if (err) {
                return done(err);
            }
            self.jobQueue.enqueue(userB, 'wadus-wadus-wadus-wadus', function(err) {
                if (err) {
                    return done(err);
                }
                seeker.seek(function(err, users) {
                    assert.ok(!err);
                    assert.equal(users.length, 2);
                    assert.ok(users[0] === userA || users[0] === userB);
                    assert.ok(users[1] === userA || users[1] === userB);

                    return done();
                });
            });
        });
    });
});
