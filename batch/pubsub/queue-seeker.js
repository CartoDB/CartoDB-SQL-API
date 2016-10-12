'use strict';

var QUEUE = require('../job_queue').QUEUE;

function QueueSeeker(pool) {
    this.pool = pool;
}

module.exports = QueueSeeker;

QueueSeeker.prototype.seek = function (callback) {
    var initialCursor = ['0'];
    var users = {};
    this._seek(initialCursor, users, callback);
};

QueueSeeker.prototype._seek = function (cursor, users, callback) {
    var self = this;
    var redisParams = [cursor[0], 'MATCH', QUEUE.PREFIX + '*'];

    this.pool.acquire(QUEUE.DB, function(err, client) {
        if (err) {
            return callback(err);
        }

        client.scan(redisParams, function(err, currentCursor) {
            // checks if iteration has ended
            if (currentCursor[0] === '0') {
                self.pool.release(QUEUE.DB, client);
                return callback(null, Object.keys(users));
            }

            var queues = currentCursor[1];

            if (!queues) {
                return callback(null);
            }

            queues.forEach(function (queue) {
                var user = queue.substr(QUEUE.PREFIX.length);
                users[user] = true;
            });

            self._seek(currentCursor, users, callback);
        });
    });
};
