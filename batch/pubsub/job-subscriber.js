'use strict';

var Channel = require('./channel');
var QueueSeeker = require('./queue-seeker');
var debug = require('./../util/debug')('pubsub:subscriber');
var error = require('./../util/debug')('pubsub:subscriber:error');

var SUBSCRIBE_INTERVAL_IN_MILLISECONDS = 10 * 60 * 1000; // 10 minutes

function JobSubscriber(pool) {
    this.pool = pool;
    this.queueSeeker = new QueueSeeker(pool);
}

module.exports = JobSubscriber;

function seeker(queueSeeker, onJobHandler) {
    queueSeeker.seek(function (err, hosts) {
        if (err) {
            return error(err);
        }
        console.log(hosts);
        debug('queues found successfully');
        hosts.forEach(onJobHandler);
    });
}

JobSubscriber.prototype.subscribe = function (onJobHandler) {
    var self = this;

    this.seekerInterval = setInterval(seeker, SUBSCRIBE_INTERVAL_IN_MILLISECONDS, this.queueSeeker, onJobHandler);

    this.pool.acquire(Channel.DB, function (err, client) {
        if (err) {
            return error('Error adquiring redis client: ' + err.message);
        }

        self.client = client;
        client.removeAllListeners('message');
        client.unsubscribe(Channel.NAME);
        client.subscribe(Channel.NAME);

        client.on('message', function (channel, host) {
            debug('message received from: ' + channel + ':' + host);
            onJobHandler(host);
        });

        client.on('error', function () {
            self.unsubscribe();
            self.pool.release(Channel.DB, client);
            self.subscribe(onJobHandler);
        });
    });

    seeker(this.queueSeeker, onJobHandler);
};

JobSubscriber.prototype.unsubscribe = function () {
    clearInterval(this.seekerInterval);
    if (this.client && this.client.connected) {
        this.client.unsubscribe(Channel.NAME);
    }
};
