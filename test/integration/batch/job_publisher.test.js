'use strict';

require('../../helper');

var BATCH_SOURCE = '../../../batch/';

var assert = require('../../support/assert');

var _ = require('underscore');
var RedisPool = require('redis-mpool');

var JobPublisher = require(BATCH_SOURCE + 'job_publisher');

var redisConfig = {
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
};

var redisPoolPublisher = new RedisPool(_.extend(redisConfig, { name: 'batch-publisher'}));
var redisPoolSubscriber = new RedisPool(_.extend(redisConfig, { name: 'batch-subscriber'}));

var HOST = 'wadus';
var CHANNEL = 'batch:hosts';
var DB = 0;

describe('job publisher', function() {
    var jobPublisher = new JobPublisher(redisPoolPublisher);

    it('.publish() should publish in job channel', function (done) {
        redisPoolSubscriber.acquire(DB, function (err, client) {
            if (err) {
                return done(err);
            }

            client.subscribe(CHANNEL);

            client.on('message', function (channel, host) {
                assert.equal(host, HOST);
                assert.equal(channel, CHANNEL) ;
                done();
            });

            jobPublisher.publish(HOST);
        });
    });

});
