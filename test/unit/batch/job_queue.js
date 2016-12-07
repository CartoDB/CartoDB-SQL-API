var JobQueue = require('../../../batch/job_queue');
var assert = require('assert');

describe('batch API job queue', function () {
    beforeEach(function () {
        this.metadataBackend = {
            redisCmd: function () {
                var callback = arguments[arguments.length -1];
                process.nextTick(function () {
                    callback(null, 'irrelevantJob');
                });
            }
        };
        this.jobPublisher = {
            publish: function () {}
        };
        this.jobQueue = new JobQueue(this.metadataBackend, this.jobPublisher);
    });

    it('.enqueue() should enqueue the provided job', function (done) {
        this.jobQueue.enqueue('irrelevantJob', 'irrelevantHost', function (err) {
            assert.ok(!err);
            done();
        });
    });

    it('.dequeue() should dequeue the next job', function (done) {
        this.jobQueue.dequeue('irrelevantHost', function (err) {
            assert.ok(!err);
            done();
        });
    });

    it('.enqueueFirst() should dequeue the next job', function (done) {
        this.jobQueue.enqueueFirst('irrelevantJob', 'irrelevantHost', function (err) {
            assert.ok(!err);
            done();
        });
    });

});
