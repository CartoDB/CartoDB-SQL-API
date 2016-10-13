var Channel = require('../../../batch/pubsub/channel');
var JobPublisher = require('../../../batch/pubsub/job-publisher');
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
            acquire: function (db, cb) {
                cb(null, self.redis);
            }
        };

        this.jobPublisher = new JobPublisher(this.pool);
    });

    it('.publish() should publish new messages', function () {
        this.jobPublisher.publish(this.host);
        assert.ok(this.redis.publishIsCalledWithValidArgs);
    });

});
