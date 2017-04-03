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
var queueDiscover = require('../../../batch/pubsub/queue-discover');

describe('batch startup', function() {
    var dbInstance = 'localhost';
    var username = 'vizzuality';
    var pool = redisUtils.getPool();
    var jobPublisher = new JobPublisher(pool);
    var jobQueue =  new JobQueue(metadataBackend, jobPublisher);
    var jobBackend = new JobBackend(metadataBackend, jobQueue);
    var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
    var jobCanceller = new JobCanceller(userDatabaseMetadataService);
    var jobService = new JobService(jobBackend, jobCanceller);

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

    it('should feed queue index at startup', function (done) {
        createJob('select pg_sleep(3)', function (err) {
            if (err) {
                return done(err);
            }

            var batch = batchFactory(metadataBackend, pool);
            batch.start();
            batch.on('ready', function () {
                var queuesDiscovered = 0;

                var onDiscoveredQueue = function () {
                    queuesDiscovered += 1;
                };

                queueDiscover(pool, onDiscoveredQueue, function (err, client, queues) {
                    if (err) {
                        done(err);
                    }

                    assert.equal(queues.length, 1);
                    assert.equal(queues[0], 'vizzuality');
                    assert.equal(queuesDiscovered, 1);

                    batch.stop(function () {
                        redisUtils.clean('batch:*', done);
                    });
                });
            });
        });
    });

});
