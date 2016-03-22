
require('../helper');

var app = require(global.settings.app_root + '/app/app')();
var assert = require('../support/assert');
var querystring = require('querystring');
var step = require('step');
var metadataBackend = require('cartodb-redis')({
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
});
var batchFactory = require('../../batch');

describe('job elapsed times', function() {

    var batch = batchFactory(metadataBackend);

    before(function () {
        batch.start();
    });

    after(function (done) {
        batch.stop();
        batch.drain(function () {
            metadataBackend.redisCmd(5, 'DEL', [ 'batch:queues:localhost' ], done);
        });
    });

    it('should perform job with elapsed times', function (done){
        step(
            function () {
                var next = this;

                assert.response(app, {
                    url: '/api/v2/sql/job?api_key=1234',
                    headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                    method: 'POST',
                    data: querystring.stringify({
                        query: "SELECT * FROM untitle_table_4"
                    })
                }, {},
                function(res, err) {
                    setTimeout(function () {
                        next(err, res);
                    }, 100);
                });
            },
            function (err, res) {
                assert.ifError(err);

                var next = this;
                var job = JSON.parse(res.body);

                assert.response(app, {
                    url: '/api/v2/sql/job/' + job.job_id + '?api_key=1234',
                    headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                    method: 'GET'
                }, {},
                function(res, err) {
                    next(err, res)
                });
            },
            function (err, res) {
                assert.ifError(err);

                var job = JSON.parse(res.body);

                assert.equal(job.waiting_elapsed_time, '0s');
                assert.equal(job.running_elapsed_time, '0s');
                assert.equal(job.total_elapsed_time, '0s');

                return null;
            },
            function finish(err) {
                done(err);
            }
        );
    });

    it('should cancel job with elapsed times', function (done){
        step(
            function () {
                var next = this;

                assert.response(app, {
                    url: '/api/v2/sql/job?api_key=1234',
                    headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                    method: 'POST',
                    data: querystring.stringify({
                        query: "SELECT pg_sleep(10)"
                    })
                }, {},
                function(res, err) {
                    setTimeout(function () {
                        next(err, res);
                    }, 100);
                });
            },
            function (err, res) {
                assert.ifError(err);

                var next = this;
                var job = JSON.parse(res.body);

                assert.response(app, {
                    url: '/api/v2/sql/job/' + job.job_id + '?api_key=1234',
                    headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                    method: 'DELETE'
                }, {},
                function(res, err) {
                    next(err, res);
                });
            },
            function (err, res) {
                assert.ifError(err);

                var job = JSON.parse(res.body);

                assert.equal(job.waiting_elapsed_time, '0s');
                assert.equal(job.running_elapsed_time, '0s');
                assert.equal(job.total_elapsed_time, '0s');

                return null;
            },
            function finish(err) {
                done(err);
            }
        );
    });

    it('should cancel a pending job with elapsed times', function (done){
        var runningJob = '';

        step(
            function () {
                var next = this;

                assert.response(app, {
                    url: '/api/v2/sql/job?api_key=1234',
                    headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                    method: 'POST',
                    data: querystring.stringify({
                        query: "SELECT pg_sleep(10)"
                    })
                }, {},
                function(res, err) {
                    next(err, res);
                });
            },
            function (err, res) {
                assert.ifError(err);

                var next = this;
                runningJob = JSON.parse(res.body);

                assert.response(app, {
                    url: '/api/v2/sql/job?api_key=1234',
                    headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                    method: 'POST',
                    data: querystring.stringify({
                        query: "SELECT pg_sleep(10)"
                    })
                }, {},
                function(res, err) {
                    setTimeout(function () {
                        next(err, res);
                    }, 100);
                });
            },
            function (err, res) {
                assert.ifError(err);

                var next = this;
                var job = JSON.parse(res.body);

                assert.response(app, {
                    url: '/api/v2/sql/job/' + job.job_id + '?api_key=1234',
                    headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                    method: 'DELETE'
                }, {},
                function(res, err) {
                    next(err, res);
                });
            },
            function (err, res) {
                assert.ifError(err);

                var job = JSON.parse(res.body);

                assert.equal(job.waiting_elapsed_time, '0s');
                assert.ok(!job.running_elapsed_time);
                assert.equal(job.total_elapsed_time, '0s');

                return null;
            },
            function (err) {
                assert.ifError(err);

                var next = this;

                assert.response(app, {
                    url: '/api/v2/sql/job/' + runningJob.job_id + '?api_key=1234',
                    headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                    method: 'DELETE'
                }, {},
                function(res, err) {
                    next(err, res);
                });
            },
            function (err, res) {
                assert.ifError(err);

                var job = JSON.parse(res.body);

                assert.equal(job.waiting_elapsed_time, '0s');
                assert.equal(job.running_elapsed_time, '0s');
                assert.equal(job.total_elapsed_time, '0s');

                return null;
            },
            function finish(err) {
                done(err);
            }
        );
    });

});
