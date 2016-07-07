'use strict';

var debug = require('./util/debug')('pubsub');
var SUBSCRIBE_INTERVAL_IN_MILLISECONDS = 10 * 60 * 1000; // 10 minutes
var redisServer = global.settings.redis_host + ':' + global.settings.redis_port;

function onReady() {
    debug('redis subscriber connected to ' + redisServer);
}

function onError(err) {
    debug('redis subscriber connection error: ' + err.message);
}

function onEnd() {
    debug('redis subscriber connection ends');
}

function onReconnect() {
    debug('redis subscriber reconnecting to ' + redisServer);
}

function _subscribe(client, channel, queueSeeker, onMessage) {

    queueSeeker.seek(onMessage, function (err) {
        if (err) {
            debug(err);
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

function JobSubscriber(redis, queueSeeker) {
    this.channel = 'batch:hosts';
    this.queueSeeker = queueSeeker;

    this.client = redis.createClient(global.settings.redis_port, global.settings.redis_host);

    this.client.on('ready', onReady);
    this.client.on('error', onError);
    this.client.on('end', onEnd);
    this.client.on('reconnecting', onReconnect);
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
