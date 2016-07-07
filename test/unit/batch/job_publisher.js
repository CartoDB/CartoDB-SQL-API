var JobPublisher = require('../../../batch/job_publisher');
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
                var isValidFirstArg = arguments[0] === 'batch:hosts';
                var isValidSecondArg = arguments[1] === self.host;
                self.redis.publishIsCalledWithValidArgs = isValidFirstArg && isValidSecondArg;
            },
            on: function () {},
            ping: function (cb) {
                cb();
            }
        };

        this.jobPublisher = new JobPublisher(this.redis);
    });

    it('.publish() should publish new messages', function () {
        this.jobPublisher.publish(this.host);
        assert.ok(this.redis.publishIsCalledWithValidArgs);
    });

});
