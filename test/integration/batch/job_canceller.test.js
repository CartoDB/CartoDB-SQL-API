'use strict';

require('../../helper');

var BATCH_SOURCE = '../../../batch/';

var assert = require('../../support/assert');
var redisUtils = require('../../support/redis_utils');

var JobQueue = require(BATCH_SOURCE + 'job_queue');
var JobBackend = require(BATCH_SOURCE + 'job_backend');
var JobPublisher = require(BATCH_SOURCE + 'pubsub/job-publisher');
var jobStatus = require(BATCH_SOURCE + 'job_status');
var UserDatabaseMetadataService = require(BATCH_SOURCE + 'user_database_metadata_service');
var JobCanceller = require(BATCH_SOURCE + 'job_canceller');
var PSQL = require('cartodb-psql');

var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var jobPublisher = new JobPublisher(redisUtils.getPool());
var jobQueue =  new JobQueue(metadataBackend, jobPublisher);
var jobBackend = new JobBackend(metadataBackend, jobQueue);
var userDatabaseMetadataService = new UserDatabaseMetadataService(metadataBackend);
var JobFactory = require(BATCH_SOURCE + 'models/job_factory');

var USER = 'vizzuality';
var QUERY = 'select pg_sleep(0)';
var HOST = 'localhost';

// sets job to running, run its query and returns inmediatly (don't wait for query finishes)
// in order to test query cancelation/draining
function runQueryHelper(job, callback) {
    var job_id = job.job_id;
    var user = job.user;
    var sql = job.query;

    job.status = jobStatus.RUNNING;

    jobBackend.update(job, function (err) {
        if (err) {
            return callback(err);
        }

        userDatabaseMetadataService.getUserMetadata(user, function (err, userDatabaseMetadata) {
            if (err) {
                return callback(err);
            }

            var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });

            sql = '/* ' + job_id + ' */ ' + sql;

            pg.eventedQuery(sql, function (err, query) {
                if (err) {
                    return callback(err);
                }

                callback(null, query);
            });
        });
    });
}

function createWadusJob(query) {
    query = query || QUERY;
    return JobFactory.create(JSON.parse(JSON.stringify({
        user: USER,
        query: query,
        host: HOST
    })));
}

describe('job canceller', function() {
    var jobCanceller = new JobCanceller(userDatabaseMetadataService);

    after(function (done) {
        redisUtils.clean('batch:*', done);
    });

    it('.cancel() should cancel a job', function (done) {
        var job = createWadusJob('select pg_sleep(1)');

        jobBackend.create(job.data, function (err, jobCreated) {
            if (err) {
                return done(err);
            }

            assert.equal(job.data.job_id, jobCreated.job_id);

            runQueryHelper(job.data, function (err) {
                if (err) {
                    return done(err);
                }

                jobCanceller.cancel(job, function (err) {
                    if (err) {
                        return done(err);
                    }

                    done();
                });
            });
        });
    });

    it('.cancel() a non running job should not return an error', function (done) {
        var job = createWadusJob();

        jobCanceller.cancel(job, function (err) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
});
