'use strict';

var Channel = require('./channel');
var QueueSeeker = require('./queue-seeker');
var debug = require('./../util/debug')('pubsub:subscriber');
var error = require('./../util/debug')('pubsub:subscriber:error');

var MINUTE = 60 * 1000;
var SUBSCRIBE_INTERVAL = 5 * MINUTE;

function JobSubscriber(pool) {
    this.pool = pool;
    this.queueSeeker = new QueueSeeker(pool);
}

module.exports = JobSubscriber;

function seeker(queueSeeker, onJobHandler, callback) {
    queueSeeker.seek(function (err, hosts) {
        if (err) {
            if (callback) {
                callback(err);
            }
            return error(err);
        }
        debug('queues found successfully');
        hosts.forEach(onJobHandler);

        if (callback) {
            return callback(null);
        }
    });
}

JobSubscriber.prototype.subscribe = function (onJobHandler, callback) {
    var self = this;

    this.seekerInterval = setInterval(seeker, SUBSCRIBE_INTERVAL, this.queueSeeker, onJobHandler);

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

    seeker(this.queueSeeker, onJobHandler, callback);
};

JobSubscriber.prototype.unsubscribe = function (callback) {
    clearInterval(this.seekerInterval);
    if (this.client && this.client.connected) {
        this.client.unsubscribe(Channel.NAME, callback);
    } else {
        return callback(null);
    }
};
