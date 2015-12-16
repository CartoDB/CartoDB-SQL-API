
var batch = require('../../batch/');
var JobPublisher = require('../../batch/job_publisher');
var JobQueueProducer = require('../../batch/job_queue_producer');

describe('batch', function() {
    it('should be initialized successfuly', function () {
        var metadataBackend = require('cartodb-redis')({
            host: global.settings.redis_host,
            port: global.settings.redis_port,
            max: global.settings.redisPool,
            idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
            reapIntervalMillis: global.settings.redisReapIntervalMillis
        });

        batch(metadataBackend);
    });

    it.skip('should perform one job', function (done) {
        var metadataBackend = require('cartodb-redis')({
            host: global.settings.redis_host,
            port: global.settings.redis_port,
            max: global.settings.redisPool,
            idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
            reapIntervalMillis: global.settings.redisReapIntervalMillis
        });
        var jobQueueProducer =  new JobQueueProducer(metadataBackend);
        var jobPublisher = new JobPublisher();

        batch(metadataBackend);

        jobQueueProducer.enqueue('vizzuality', '127.0.0.1', function (err) {
            if (err) {
                return done(err);
            }
            jobPublisher.publish('127.0.0.1');
            setTimeout(function () {
                done();
            }, 4000);
        });
    });
});
