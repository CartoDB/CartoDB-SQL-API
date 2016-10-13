'use strict';

var QUEUE = require('../job_queue').QUEUE;

function QueueSeeker(pool) {
    this.pool = pool;
}

module.exports = QueueSeeker;

QueueSeeker.prototype.seek = function (callback) {
    var initialCursor = ['0'];
    var hosts = {};
    var self = this;

    this.pool.acquire(QUEUE.DB, function(err, client) {
        if (err) {
            return callback(err);
        }
        self._seek(client, initialCursor, hosts, function(err, hosts) {
            self.pool.release(QUEUE.DB, client);
            return callback(err, hosts);
        });
    });
};

QueueSeeker.prototype._seek = function (client, cursor, hosts, callback) {
    var self = this;
    var redisParams = [cursor[0], 'MATCH', QUEUE.PREFIX + '*'];

    client.scan(redisParams, function(err, currentCursor) {
        // checks if iteration has ended
        if (currentCursor[0] === '0') {
            self.pool.release(QUEUE.DB, client);
            return callback(null, Object.keys(hosts));
        }

        var queues = currentCursor[1];

        if (!queues) {
            return callback(null);
        }

        queues.forEach(function (queue) {
            var host = queue.substr(QUEUE.PREFIX.length);
            hosts[host] = true;
        });

        self._seek(client, currentCursor, hosts, callback);
    });
};
