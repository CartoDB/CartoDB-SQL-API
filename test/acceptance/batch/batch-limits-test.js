'use strict';

require('../../helper');

var assert = require('../../support/assert');
var BatchTestClient = require('../../support/batch-test-client');
var JobStatus = require('../../../lib/batch/job-status');
var redisUtils = require('../../support/redis-utils');
var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
const dbUtils = require('../../support/db_utils');

describe('batch query statement_timeout limit', function () {
    before(function (done) {
        this.batchTestClient = new BatchTestClient();
        this.batchQueryTimeout = global.settings.batch_query_timeout;
        global.settings.batch_query_timeout = 15000;
        metadataBackend.redisCmd(global.settings.batch_db, 'HMSET', ['limits:batch:vizzuality', 'timeout', 100], done);
    });
    before(dbUtils.resetPgBouncerConnections);
    after(function (done) {
        global.settings.batch_query_timeout = this.batchQueryTimeout;
        redisUtils.clean(global.settings.batch_db, 'limits:batch:*', function () {
            this.batchTestClient.drain(done);
        }.bind(this));
    });
    after(dbUtils.resetPgBouncerConnections);

    function jobPayload (query) {
        return {
            query: query
        };
    }

    it('should cancel with user statement_timeout limit', function (done) {
        var payload = jobPayload('select pg_sleep(10)');
        this.batchTestClient.createJob(payload, function (err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.strictEqual(job.status, JobStatus.FAILED);
                assert.ok(job.failed_reason.match(/statement.*timeout/));
                return done();
            });
        });
    });
});
