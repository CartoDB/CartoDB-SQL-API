require('../../helper');

var assert = require('../../support/assert');
var BatchTestClient = require('../../support/batch-test-client');
var JobStatus = require('../../../batch/job_status');
var redisUtils = require('../../support/redis_utils');
var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });

describe.skip('batch query statement_timeout limit', function() {

    before(function(done) {
        this.batchTestClient = new BatchTestClient();
        this.batchQueryTimeout = global.settings.batch_query_timeout;
        global.settings.batch_query_timeout = 15000;
        metadataBackend.redisCmd(5, 'HMSET', ['limits:batch:vizzuality', 'timeout', 100], done);
    });

    after(function(done) {
        global.settings.batch_query_timeout = this.batchQueryTimeout;
        redisUtils.clean('limits:batch:*', function() {
            this.batchTestClient.drain(done);
        }.bind(this));
    });

    function jobPayload(query) {
        return {
            query: query
        };
    }

    it('should cancel with user statement_timeout limit', function (done) {
        var payload = jobPayload('select pg_sleep(10)');
        this.batchTestClient.createJob(payload, function(err, jobResult) {
            if (err) {
                return done(err);
            }
            jobResult.getStatus(function (err, job) {
                if (err) {
                    return done(err);
                }
                assert.equal(job.status, JobStatus.FAILED);
                assert.ok(job.failed_reason.match(/statement.*timeout/));
                return done();
            });
        });
    });

});
