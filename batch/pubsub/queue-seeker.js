'use strict';

function QueueSeeker(pool) {
    this.db = 5;
    this.channel = 'batch:hosts';
    this.redisPrefix = 'batch:queues:';
    this.pattern = this.redisPrefix + '*';
    this.pool = pool;
}

module.exports = QueueSeeker;

QueueSeeker.prototype.seek = function (callback) {
    var initialCursor = ['0'];
    var hosts = {};
    this._seek(initialCursor, hosts, callback);
};

QueueSeeker.prototype._seek = function (cursor, hosts, callback) {
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
                return callback(null, Object.keys(hosts));
            }

            var queues = currentCursor[1];

            if (!queues) {
                return callback(null);
            }

            queues.forEach(function (queue) {
                var host = queue.substr(self.redisPrefix.length);
                hosts[host] = true;
            });

            self._seek(currentCursor, hosts, callback);
        });
    });
};
