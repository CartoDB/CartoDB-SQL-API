'use strict';

function JobPublisher(redis) {
    this.channel = 'batch:hosts';
    this.client = redis.createClient(global.settings.redis_port, global.settings.redis_host);
}

JobPublisher.prototype.publish = function (host) {
    this.client.publish(this.channel, host);
};

module.exports = JobPublisher;
