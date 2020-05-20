'use strict';

require('../../helper');

var BATCH_SOURCE = '../../../lib/batch/';

var assert = require('../../support/assert');

var redisUtils = require('../../support/redis-utils');

var Channel = require(BATCH_SOURCE + 'pubsub/channel');
var JobPublisher = require(BATCH_SOURCE + 'pubsub/job-publisher');

var HOST = 'wadus';

describe('job publisher', function () {
    var jobPublisher = new JobPublisher(redisUtils.getPool());

    it('.publish() should publish in job channel', function (done) {
        redisUtils.getPool().acquire(Channel.DB)
            .then(client => {
                client.subscribe(Channel.NAME);

                client.on('message', function (channel, host) {
                    assert.strictEqual(host, HOST);
                    assert.strictEqual(channel, Channel.NAME);
                    client.unsubscribe(Channel.NAME);
                    redisUtils.getPool().release(Channel.DB, client)
                        .then(() => done())
                        .catch((err) => done(err));
                });

                jobPublisher.publish(HOST);
            })
            .catch((err) => done(err));
    });
});
