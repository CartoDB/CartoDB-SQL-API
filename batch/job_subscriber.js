'use strict';

var redis = require('redis');

function JobSubscriber() {
    this.channel = 'host:job';
    this.client = redis.createClient(global.settings.redis_port, global.settings.redis_host);
}

JobSubscriber.prototype.subscribe = function (onMessage) {
    this.client.subscribe(this.channel);
    this.client.on('message', onMessage);
};

JobSubscriber.prototype.unsubscribe = function () {
    this.client.unsubscribe(this.channel);
};

module.exports = JobSubscriber;
