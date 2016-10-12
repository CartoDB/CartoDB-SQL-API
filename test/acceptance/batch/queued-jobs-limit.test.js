require('../../helper');

var assert = require('../../support/assert');
var redisUtils = require('../../support/redis_utils');
var batchFactory = require('../../../batch/index');
var metadataBackend = require('cartodb-redis')(redisUtils.getConfig());

describe('max queued jobs', function() {

    before(function() {
        this.batch_max_queued_jobs = global.settings.batch_max_queued_jobs;
        global.settings.batch_max_queued_jobs = 1;
        this.server = require('../../../app/server')();
    });

    after(function (done) {
        global.settings.batch_max_queued_jobs = this.batch_max_queued_jobs;
        var batch = batchFactory(metadataBackend, redisUtils.getConfig());
        batch.start();
        batch.on('ready', function() {
            batch.stop();
            redisUtils.clean('batch:*', done);
        });
    });

    function createJob(server, status, callback) {
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
                    query: "SELECT * FROM untitle_table_4"
                })
            },
            {
                status: status
            },
            function(err, res) {
                if (err) {
                    return callback(err);
                }

                return callback(null, JSON.parse(res.body));
            }
        );
    }

    it('POST /api/v2/sql/job should respond with 200 and the created job', function (done) {
        var self = this;
        createJob(this.server, 201, function(err) {
            assert.ok(!err);

            createJob(self.server, 400, function(err, res) {
                assert.ok(!err);
                assert.equal(res.error[0], "Failed to create job, max number of jobs queued reached");
                console.log(res.body);
                done();
            });
        });
    });

});
