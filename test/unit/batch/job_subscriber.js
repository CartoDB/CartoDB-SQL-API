var JobSubscriber = require('../../../batch/job_subscriber');
var assert = require('assert');

describe('batch API job subscriber', function () {
    beforeEach(function () {
        var self = this;
        this.onMessageListener = function () {};
        this.redis = {
            createClient: function () {
                return this;
            },
            subscribe: function () {
                var isValidFirstArg = arguments[0] === 'batch:hosts';
                self.redis.subscribeIsCalledWithValidArgs = isValidFirstArg;
            },
            on: function () {
                var isValidFirstArg = arguments[0] === 'message';
                var isValidSecondArg = arguments[1] === self.onMessageListener;
                self.redis.onIsCalledWithValidArgs = isValidFirstArg && isValidSecondArg;
            },
            unsubscribe: function () {
                var isValidFirstArg = arguments[0] === 'batch:hosts';
                self.redis.unsubscribeIsCalledWithValidArgs = isValidFirstArg;
            }
        };
        this.metadataBackend = {
            redisCmd: function () {
                var callback = arguments[3];

                callback(null, []);
            }
        };

        this.jobSubscriber = new JobSubscriber(this.redis, this.metadataBackend);
    });

    it('.subscribe() should listen for incoming messages', function () {
        this.jobSubscriber.subscribe(this.onMessageListener);
        assert.ok(this.redis.onIsCalledWithValidArgs);
        assert.ok(this.redis.subscribeIsCalledWithValidArgs);
    });

    it('.unsubscribe() should stop listening for incoming messages', function () {
        this.jobSubscriber.unsubscribe();
        assert.ok(this.redis.unsubscribeIsCalledWithValidArgs);
    });

});
