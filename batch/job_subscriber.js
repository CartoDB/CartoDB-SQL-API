'use strict';

function JobSubscriber(redis, queueSeeker) {
    this.channel = 'batch:hosts';
    this.client = redis.createClient(global.settings.redis_port, global.settings.redis_host);
    this.queueSeeker = queueSeeker;
}

JobSubscriber.prototype.subscribe = function (onMessage) {
    var self = this;

    self.queueSeeker.seek(onMessage, function (err) {
        if (err) {
            console.error(err);
        }

        self.client.subscribe(self.channel);
        self.client.on('message', onMessage);
    });
};

JobSubscriber.prototype.unsubscribe = function () {
    this.client.unsubscribe(this.channel);
};

module.exports = JobSubscriber;
