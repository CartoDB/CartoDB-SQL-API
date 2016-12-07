var Channel = require('../../../batch/pubsub/channel');
var JobSubscriber = require('../../../batch/pubsub/job-subscriber');
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
                var isValidFirstArg = arguments[0] === Channel.NAME;
                self.redis.subscribeIsCalledWithValidArgs = isValidFirstArg;
            },
            on: function () {
                if (arguments[0] === 'message') {
                    self.redis.onIsCalledWithValidArgs = true;
                }
            },
            unsubscribe: function () {
                var isValidFirstArg = arguments[0] === Channel.NAME;
                self.redis.unsubscribeIsCalledWithValidArgs = isValidFirstArg;
            },
            scan: function(params, callback) {
                return callback(null, ['0']);
            },
            removeAllListeners: function () {
                return this;
            },
            connected: true
        };
        this.pool = {
            acquire: function (db, cb) {
                cb(null, self.redis);
            },
            release: function(/*db, client*/) {

            }
        };
        this.queueSeeker = {
            seek: function () {
                var callback = arguments[1];

                callback(null, []);
            }
        };

        this.jobSubscriber = new JobSubscriber(this.pool, this.queueSeeker);
    });

    it('.subscribe() should listen for incoming messages', function () {
        this.jobSubscriber.subscribe(this.onMessageListener);
        assert.ok(this.redis.onIsCalledWithValidArgs);
        assert.ok(this.redis.subscribeIsCalledWithValidArgs);
    });

    it('.unsubscribe() should stop listening for incoming messages', function () {
        this.jobSubscriber.subscribe(this.onMessageListener);
        this.jobSubscriber.unsubscribe();
        assert.ok(this.redis.unsubscribeIsCalledWithValidArgs);
    });

});
