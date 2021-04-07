'use strict';

require('../../helper');

var BATCH_SOURCE = '../../../lib/batch/';

var assert = require('../../support/assert');
var redisUtils = require('../../support/redis-utils');

var Logger = require('../../../lib/utils/logger');
var JobQueue = require(BATCH_SOURCE + 'job-queue');
var JobBackend = require(BATCH_SOURCE + 'job-backend');
var JobPublisher = require(BATCH_SOURCE + 'pubsub/job-publisher');
var jobStatus = require(BATCH_SOURCE + 'job-status');
var JobCanceller = require(BATCH_SOURCE + 'job-canceller');
var JobFactory = require(BATCH_SOURCE + 'models/job-factory');
var PSQL = require('cartodb-psql');

var logger = new Logger();
var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var jobPublisher = new JobPublisher(redisUtils.getPool());
var jobQueue = new JobQueue(metadataBackend, jobPublisher, logger);
var jobBackend = new JobBackend(metadataBackend, jobQueue, logger);

const TEST_USER_ID = 1;
const TEST_USER = global.settings.db_user.replace('<%= user_id %>', TEST_USER_ID);
const TEST_DB = global.settings.db_base_name.replace('<%= user_id %>', TEST_USER_ID);

var USER = 'vizzuality';
var QUERY = 'select pg_sleep(0)';

// sets job to running, run its query and returns inmediatly (don't wait for query finishes)
// in order to test query cancelation/draining
function runQueryHelper (job, callback) {
    var jobId = job.job_id;
    var sql = job.query;

    job.status = jobStatus.RUNNING;

    jobBackend.update(job, function (err) {
        if (err) {
            return callback(err);
        }

        const dbConfiguration = {
            host: job.host,
            port: job.port,
            dbname: job.dbname,
            user: job.dbuser,
            pass: job.pass
        };

        const pg = new PSQL(dbConfiguration);

        sql = '/* ' + jobId + ' */ ' + sql;

        pg.eventedQuery(sql, function (err, query) {
            if (err) {
                return callback(err);
            }

            callback(null, query);
        });
    });
}

function createWadusJob (query) {
    query = query || QUERY;
    return JobFactory.create(JSON.parse(JSON.stringify({
        user: USER,
        query: query,
        host: global.settings.db_host,
        dbname: TEST_DB,
        dbuser: TEST_USER,
        port: global.settings.db_batch_port,
        pass: global.settings.db_user_pass

    })));
}

describe('job canceller', function () {
    var jobCanceller = new JobCanceller();

    after(function (done) {
        redisUtils.clean(global.settings.batch_db, 'batch:*', done);
    });

    it('.cancel() should cancel a job', function (done) {
        var job = createWadusJob('select pg_sleep(1)');

        jobBackend.create(job.data, function (err, jobCreated) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(job.data.job_id, jobCreated.job_id);

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
