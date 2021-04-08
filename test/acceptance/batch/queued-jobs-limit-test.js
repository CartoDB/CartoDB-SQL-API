'use strict';

require('../../helper');

var assert = require('../../support/assert');
var redisUtils = require('../../support/redis-utils');
var TestClient = require('../../support/test-client');

describe('max queued jobs', function () {
    before(function (done) {
        this.batch_max_queued_jobs = global.settings.batch_max_queued_jobs;
        global.settings.batch_max_queued_jobs = 1;
        this.server = require('../../../lib/server')();
        this.testClient = new TestClient();
        this.testClient.getResult(
            'drop table if exists max_queued_jobs_inserts; create table max_queued_jobs_inserts (status numeric)',
            done
        );
    });

    after(function (done) {
        global.settings.batch_max_queued_jobs = this.batch_max_queued_jobs;
        redisUtils.clean(global.settings.batch_db, 'batch:*', done);
    });

    function createJob (server, status, callback) {
        assert.response(
            server,
            {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    host: 'vizzuality.cartodb.com',
                    'Content-Type': 'application/json'
                },
                method: 'POST',
                data: JSON.stringify({
                    query: 'insert into max_queued_jobs_inserts values (1)'
                })
            },
            {
                status: status
            },
            function (err, res) {
                if (err) {
                    return callback(err);
                }

                return callback(null, JSON.parse(res.body));
            }
        );
    }

    it('POST /api/v2/sql/job should respond with 200 and the created job', function (done) {
        var self = this;
        createJob(this.server, 201, function (err) {
            assert.ok(!err);

            createJob(self.server, 400, function (err, res) {
                assert.ok(!err);
                assert.strictEqual(res.error[0], 'Failed to create job. Max number of jobs (' +
                    global.settings.batch_max_queued_jobs + ') queued reached');
                done();
            });
        });
    });
});
