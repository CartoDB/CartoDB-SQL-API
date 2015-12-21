var assert = require('assert');
var batch = require('../../batch/');
var JobPublisher = require('../../batch/job_publisher');
var JobQueueProducer = require('../../batch/job_queue_producer');
var JobBackend = require('../../batch/job_backend');
var UserDatabaseMetadataService = require('../../batch/user_database_metadata_service');
var metadataBackend = require('cartodb-redis')({
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
});

describe('batch', function() {

    it('should perform one job', function (done) {
        var jobQueueProducer =  new JobQueueProducer(metadataBackend);
        var jobPublisher = new JobPublisher();
        var jobBackend = new JobBackend(metadataBackend);
        var username = 'vizzuality';
        var _jobId = '';

        var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);

        userDatabaseMetadataService.getUserMetadata(username, function (err, userDatabaseMetadata) {
            if (err) {
                return done(err);
            }

            var sql = "select * from private_table limit 1";

            // create job in redis
            jobBackend.create(username, sql, function (err, job) {
                if (err) {
                    return done(err);
                }

                _jobId = job.jobId;

                jobQueueProducer.enqueue(job.jobId, userDatabaseMetadata.host, function (err) {
                    if (err) {
                        return done(err);
                    }

                    jobPublisher.publish(userDatabaseMetadata.host);
                });
            });
        });

        batch(metadataBackend)
            .on('job:done', function (jobId) {
                assert.equal(_jobId, jobId);
                done();
            });
    });
});
