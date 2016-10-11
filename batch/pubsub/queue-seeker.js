'use strict';

function QueueSeeker(pool) {
    this.db = 5;
    this.channel = 'batch:hosts';
    this.redisPrefix = 'batch:queues:';
    this.pattern = this.redisPrefix + '*';
    this.pool = pool;
}

module.exports = QueueSeeker;

QueueSeeker.prototype.seek = function (onMessage, callback) {
    var initialCursor = ['0'];
    this.onMessage = onMessage;

    this._seek(initialCursor, callback);
};

QueueSeeker.prototype._seek = function (cursor, callback) {
    var self = this;
    var redisParams = [cursor[0], 'MATCH', self.pattern];

    this.pool.acquire(this.db, function(err, client) {
        if (err) {
            return callback(err);
        }

        client.scan(redisParams, function(err, currentCursor) {
            // checks if iteration has ended
            if (currentCursor[0] === '0') {
                self.pool.release(self.db, client);
                return callback(null);
            }

            var queues = currentCursor[1];

            if (!queues) {
                return callback(null);
            }

            queues.forEach(function (queue) {
                var host = queue.substr(self.redisPrefix.length);
                self.onMessage(self.channel, host);
            });

            self._seek(currentCursor, callback);
        });
    });
};
