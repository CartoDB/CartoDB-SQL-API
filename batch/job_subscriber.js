'use strict';

function JobSubscriber(redis, metadataBackend) {
    this.channel = 'batch:hosts';
    this.client = redis.createClient(global.settings.redis_port, global.settings.redis_host);
    this.metadataBackend = metadataBackend;
    this.db = 5;
    this.redisPrefix = 'batch:queues:';
}

JobSubscriber.prototype.subscribe = function (onMessage) {
    var self = this;
    var redisParams = [ this.redisPrefix + '*' ];

    self.metadataBackend.redisCmd(self.db, 'KEYS', redisParams , function (err, queues) {
        if (err) {
            console.error(err);
        }

        if (queues) {
            queues.forEach(function (queue) {
                var host = queue.substr(queue.lastIndexOf(':') + 1);
                onMessage(self.channel, host);
            });
        }

        self.client.subscribe(self.channel);
        self.client.on('message', onMessage);
    });
};

JobSubscriber.prototype.unsubscribe = function () {
    this.client.unsubscribe(this.channel);
};

module.exports = JobSubscriber;
