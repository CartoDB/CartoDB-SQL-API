'use strict';

var debug = require('./util/debug')('pubsub');
var redisServer = global.settings.redis_host + ':' + global.settings.redis_port;

function onReady() {
    debug('redis publisher connected to ' + redisServer);
}

function onError(err) {
    debug('redis publisher connection error: ' + err.message);
}

function onEnd() {
    debug('redis publisher connection ends');
}

function onReconnect() {
    debug('redis publisher reconnecting to ' + redisServer);
}

function JobPublisher(redis) {
    this.redis = redis;
    this.channel = 'batch:hosts';

    this._createClient();
}

JobPublisher.prototype._createClient = function () {
    if (this.client && this.client.connected) {
        this.client.end(true);
    }

    this.client = this.redis.createClient(global.settings.redis_port, global.settings.redis_host);
    this.client.on('ready', onReady);
    this.client.on('error', onError);
    this.client.on('end', onEnd);
    this.client.on('reconnecting', onReconnect);
};

JobPublisher.prototype.publish = function (host) {
    var self = this;

    this.client.ping(function (err) {
        if (err) {
            debug('Error sending a ping to server: ' + err.message);
            self._createClient();
        }

        debug('publish to ' + self.channel + ':' + host);
        self.client.publish(self.channel, host);
    });
};

module.exports = JobPublisher;
