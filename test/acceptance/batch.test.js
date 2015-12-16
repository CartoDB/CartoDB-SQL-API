var assert = require('assert');
var batchFactory = require('../../batch/');
var JobPublisher = require('../../batch/job_publisher');
var JobQueueProducer = require('../../batch/job_queue_producer');
var Job = require('../../batch/job');
var UserDatabaseMetadataService = require('../../batch/user_database_metadata_service');
var PSQL = require('cartodb-psql');
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
        var job = new Job();
        var username = 'vizzuality';
        var jobId = '';

        var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);

        userDatabaseMetadataService.getUserMetadata(username, function (err, userDatabaseMetadata) {
            if (err) {
                return done(err);
            }

            var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });
            var sql = "select * from private_table limit 1";

            job.createJob(pg, username, sql, function (err, result) {
                if (err) {
                    return done(err);
                }

                jobId = result.rows[0].job_id;

                jobQueueProducer.enqueue(username, userDatabaseMetadata.host, function (err) {
                    if (err) {
                        return done(err);
                    }

                    jobPublisher.publish(userDatabaseMetadata.host);
                });
            });
        });

        var batch = batchFactory(metadataBackend);

        batch.on('job:done', function (job) {
            assert.equal(jobId, job.job_id);
            done();
        });
    });
});
