'use strict';

var debug = require('./util/debug')('pubsub:subscriber');
var error = require('./util/debug')('pubsub:subscriber:error');

var DB = 0;
var SUBSCRIBE_INTERVAL_IN_MILLISECONDS = 10 * 60 * 1000; // 10 minutes

function _subscribe(client, channel, queueSeeker, onMessage) {

    queueSeeker.seek(onMessage, function (err) {
        if (err) {
            error(err);
        }

        client.removeAllListeners('message');
        client.unsubscribe(channel);
        client.subscribe(channel);

        client.on('message', function (channel, host) {
            debug('message received from: ' + channel + ':' + host);
            onMessage(channel, host);
        });
    });
}

function JobSubscriber(pool, queueSeeker) {
    this.channel = 'batch:hosts';
    this.pool = pool;
    this.queueSeeker = queueSeeker;
}

module.exports = JobSubscriber;

JobSubscriber.prototype.subscribe = function (onMessage) {
    var self = this;

    this.pool.acquire(DB, function (err, client) {
        if (err) {
            return error('Error adquiring redis client: ' + err.message);
        }

        self.client = client;

        _subscribe(self.client, self.channel, self.queueSeeker, onMessage);

        self.seekerInterval = setInterval(
            _subscribe,
            SUBSCRIBE_INTERVAL_IN_MILLISECONDS,
            self.client,
            self.channel,
            self.queueSeeker,
            onMessage
        );
    });

};

JobSubscriber.prototype.unsubscribe = function () {
    clearInterval(this.seekerInterval);
    if (this.client && this.client.connected) {
        this.client.unsubscribe(this.channel);
    }
};
