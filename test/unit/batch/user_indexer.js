var UserIndexer = require('../../../batch/user_indexer');
var assert = require('assert');

describe('batch API user indexer', function () {
    describe('backend works well', function () {
        beforeEach(function () {
            this.metadataBackend = {
                redisCmd: function () {
                    var callback = arguments[arguments.length -1];
                    process.nextTick(function () {
                        callback(null, 'irrelevantJob');
                    });
                }
            };
            this.userIndexer = new UserIndexer(this.metadataBackend);
        });

        it('.add() should save the given job into the given username list', function (done) {
            this.userIndexer.add('irrelevantUsername', 'irrelevantJobId', function (err) {
                assert.ok(!err);
                done();
            });
        });

        it('.list() should list jobs of the given username', function (done) {
            this.userIndexer.list('irrelevantUsername', function (err) {
                assert.ok(!err);
                done();
            });
        });

        it('.remove() should remove the job id from the given username list', function (done) {
            this.userIndexer.remove('irrelevantUsername', 'irrelevantJobId', function (err) {
                assert.ok(!err);
                done();
            });
        });
    });


    describe('backend fails', function () {
        beforeEach(function () {
            this.metadataBackend = {
                redisCmd: function () {
                    var callback = arguments[arguments.length -1];
                    process.nextTick(function () {
                        callback(new Error('Something went wrong'));
                    });
                }
            };
            this.userIndexer = new UserIndexer(this.metadataBackend);
        });

        it('.add() should save the given job into the given username list', function (done) {
            this.userIndexer.add('irrelevantUsername', 'irrelevantJobId', function (err) {
                assert.ok(err);
                assert.ok(err.message, 'Something went wrong');
                done();
            });
        });

        it('.list() should list jobs of the given username', function (done) {
            this.userIndexer.list('irrelevantUsername', function (err) {
                assert.ok(err);
                assert.ok(err.message, 'Something went wrong');
                done();
            });
        });

        it('.remove() should remove the job id from the given username list', function (done) {
            this.userIndexer.remove('irrelevantUsername', 'irrelevantJobId', function (err) {
                assert.ok(err);
                assert.ok(err.message, 'Something went wrong');
                done();
            });
        });

    });

});
