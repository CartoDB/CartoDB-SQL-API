'use strict';

var Channel = require('../../../lib/batch/pubsub/channel');
var JobPublisher = require('../../../lib/batch/pubsub/job-publisher');
var assert = require('assert');

describe('batch API job publisher', function () {
    beforeEach(function () {
        var self = this;
        this.host = 'irrelevantHost';
        this.redis = {
            createClient: function () {
                return this;
            },
            publish: function () {
                var isValidFirstArg = arguments[0] === Channel.NAME;
                var isValidSecondArg = arguments[1] === self.host;
                self.redis.publishIsCalledWithValidArgs = isValidFirstArg && isValidSecondArg;
            },
            on: function () {},
            ping: function (cb) {
                cb();
            }
        };
        this.pool = {
            acquire: function (db) {
                return Promise.resolve(self.redis);
            }
        };

        this.jobPublisher = new JobPublisher(this.pool);
    });

    it('.publish() should publish new messages', function () {
        this.jobPublisher.publish(this.host);
        setImmediate(() => {
            assert.ok(this.redis.publishIsCalledWithValidArgs);
        });
    });
});
