'use strict';

require('../../helper');
var assert = require('../../support/assert');
var redisUtils = require('../../support/redis_utils');

var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var JobPublisher = require('../../../batch/pubsub/job-publisher');
var JobQueue = require('../../../batch/job_queue');

var jobPublisher = new JobPublisher(redisUtils.getPool());
var queueDiscover = require('../../../batch/pubsub/queue-discover');

describe('queue discover', function () {
    var userA = 'userA';
    var userB = 'userB';

    beforeEach(function () {
        this.jobQueue = new JobQueue(metadataBackend, jobPublisher);
    });

    afterEach(function (done) {
        redisUtils.clean('batch:*', done);
    });

    it('should find queues for one user', function (done) {
        this.jobQueue.enqueue(userA, 'wadus-wadus-wadus-wadus', function(err) {
            if (err) {
                return done(err);
            }

            var onQueueDiscoveredCalledNumber = 0;

            function onQueueDiscovered () {
                onQueueDiscoveredCalledNumber += 1;
            }

            queueDiscover(redisUtils.getPool(), onQueueDiscovered, function (err, client, queues) {
                assert.ifError(err);
                assert.equal(queues.length, 1);
                assert.equal(onQueueDiscoveredCalledNumber, queues.length);
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

                var onQueueDiscoveredCalledNumber = 0;

                function onQueueDiscovered () {
                    onQueueDiscoveredCalledNumber += 1;
                }

                queueDiscover(redisUtils.getPool(), onQueueDiscovered, function (err, client, queues) {
                    assert.ifError(err);
                    assert.equal(queues.length, 2);
                    assert.equal(onQueueDiscoveredCalledNumber, queues.length);
                    assert.ok(queues[0] === userA || queues[0] === userB);
                    assert.ok(queues[1] === userA || queues[1] === userB);

                    return done();
                });
            });
        });
    });
});
