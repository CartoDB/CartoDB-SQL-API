var UsernameQueue = require('../../../batch/username_queue');
var assert = require('assert');

describe('batch API username queue', function () {
    beforeEach(function () {
        this.metadataBackend = {
            redisCmd: function () {
                var callback = arguments[arguments.length -1];
                process.nextTick(function () {
                    callback(null, 'irrelevantUsername');
                });
            }
        };
        this.usernameQueue = new UsernameQueue(this.metadataBackend);
    });

    it('.enqueue(username) should enqueue the provided username', function (done) {
        this.usernameQueue.enqueue('irrelevantUsername', function (err, username) {
            assert.ok(!err);
            assert.equal(username, 'irrelevantUsername');
            done();
        });
    });

    it('.dequeue(username) should dequeue the next username', function (done) {
        this.usernameQueue.dequeue(function (err, username) {
            assert.ok(!err);
            assert.equal(username, 'irrelevantUsername');
            done();
        });
    });

});
