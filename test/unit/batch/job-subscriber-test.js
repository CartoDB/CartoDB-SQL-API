'use strict';

var Channel = require('../../../lib/batch/pubsub/channel');
var JobSubscriber = require('../../../lib/batch/pubsub/job-subscriber');
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
            scan: function (params, callback) {
                return callback(null, ['0']);
            },
            removeAllListeners: function () {
                return this;
            },
            smembers: function (key, callback) {
                callback(null, []);
            },
            connected: true
        };
        this.pool = {
            acquire: function () {
                return Promise.resolve(self.redis);
            },
            release: function (/* db, client */) {
                return Promise.resolve();
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
        setImmediate(() => {
            assert.ok(this.redis.onIsCalledWithValidArgs);
            assert.ok(this.redis.subscribeIsCalledWithValidArgs);
        });
    });

    it('.unsubscribe() should stop listening for incoming messages', function () {
        this.jobSubscriber.subscribe(this.onMessageListener);
        this.jobSubscriber.unsubscribe();
        setImmediate(() => {
            assert.ok(this.redis.unsubscribeIsCalledWithValidArgs);
        });
    });
});
