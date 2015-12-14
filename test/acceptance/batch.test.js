
var batchManagerFactory = require('../../batch/batch_manager_factory');

describe('batch manager', function() {
    it('run', function (done) {
        var metadataBackend = require('cartodb-redis')({
            host: global.settings.redis_host,
            port: global.settings.redis_port,
            max: global.settings.redisPool,
            idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
            reapIntervalMillis: global.settings.redisReapIntervalMillis
        });
        var maxJobsPerHost = 100;

        batchManagerFactory(metadataBackend, maxJobsPerHost).run(function (err) {
            done(err);
        });
    });
});
