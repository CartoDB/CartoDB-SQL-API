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

    self._lookForQueues(onMessage, function (err) {
        if (err) {
            console.error(err);
        }

        self.client.subscribe(self.channel);
        self.client.on('message', onMessage);
    });
};

JobSubscriber.prototype._lookForQueues = function (onMessage, callback) {
    var pattern = this.redisPrefix + '*';

    scanQueues(this.metadataBackend, this.db, ['0'], pattern, this.channel, onMessage, callback);
};

function scanQueues(metadataBackend, db, cursor, pattern, channel, onMessage, callback) {
    var redisParams = [cursor[0], 'MATCH', pattern];

    metadataBackend.redisCmd(db, 'SCAN', redisParams, function (err, currentCursor) {
        if (err) {
            return callback(err);
        }

        // checks if iteration has ended
        if (currentCursor[0] === '0') {
            return callback(null);
        }

        var queues = currentCursor[1];

        if (!queues) {
            return callback(null);
        }

        queues.forEach(function (queue) {
            var host = queue.substr(queue.lastIndexOf(':') + 1);
            onMessage(channel, host);
        });

        scanQueues(metadataBackend, db, currentCursor, pattern, channel, onMessage, callback);
    });
}

JobSubscriber.prototype.unsubscribe = function () {
    this.client.unsubscribe(this.channel);
};

module.exports = JobSubscriber;
