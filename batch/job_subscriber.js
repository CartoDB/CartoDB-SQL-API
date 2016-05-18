'use strict';

var debug = require('./util/debug')('job-subscriber');
var SUBSCRIBE_INTERVAL_IN_MILLISECONDS = 10 * 60 * 1000; // 10 minutes

function _subscribe(client, channel, queueSeeker, onMessage) {
    queueSeeker.seek(onMessage, function (err) {
        if (err) {
            debug(err);
        }

        client.removeAllListeners('message');
        client.unsubscribe(channel);
        client.subscribe(channel);
        client.on('message', onMessage);
    });
}

function JobSubscriber(redis, queueSeeker) {
    this.channel = 'batch:hosts';
    this.client = redis.createClient(global.settings.redis_port, global.settings.redis_host);
    this.queueSeeker = queueSeeker;
}

module.exports = JobSubscriber;

JobSubscriber.prototype.subscribe = function (onMessage) {
    var self = this;

    _subscribe(this.client, this.channel, this.queueSeeker, onMessage);

    this.seekerInterval = setInterval(
        _subscribe,
        SUBSCRIBE_INTERVAL_IN_MILLISECONDS,
        this.client,
        this.channel,
        self.queueSeeker,
        onMessage
    );
};

JobSubscriber.prototype.unsubscribe = function () {
    clearInterval(this.seekerInterval);
    this.client.unsubscribe(this.channel);
};
