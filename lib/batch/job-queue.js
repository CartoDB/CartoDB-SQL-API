'use strict';

var queueAsync = require('queue-async');

function JobQueue (metadataBackend, jobPublisher, logger) {
    this.metadataBackend = metadataBackend;
    this.jobPublisher = jobPublisher;
    this.logger = logger;
}

module.exports = JobQueue;

var QUEUE = {
    DB: global.settings.batch_db || 5,
    PREFIX: 'batch:queue:',
    INDEX: 'batch:indexes:queue'
};

module.exports.QUEUE = QUEUE;

JobQueue.prototype.enqueue = function (user, jobId, callback) {
    this.logger.debug('JobQueue.enqueue user=%s, jobId=%s', user, jobId);

    this.metadataBackend.redisMultiCmd(QUEUE.DB, [
        ['LPUSH', QUEUE.PREFIX + user, jobId],
        ['SADD', QUEUE.INDEX, user]
    ], function (err) {
        if (err) {
            return callback(err);
        }

        this.jobPublisher.publish(user);
        callback();
    }.bind(this));
};

JobQueue.prototype.size = function (user, callback) {
    this.metadataBackend.redisCmd(QUEUE.DB, 'LLEN', [QUEUE.PREFIX + user], callback);
};

JobQueue.prototype.dequeue = function (user, callback) {
    var self = this;
    var dequeueScript = [
        'local job_id = redis.call("RPOP", KEYS[1])',
        'if redis.call("LLEN", KEYS[1]) == 0 then',
        '   redis.call("SREM", KEYS[2], ARGV[1])',
        'end',
        'return job_id'
    ].join('\n');

    var redisParams = [
        dequeueScript, // lua source code
        2, // Two "keys" to pass
        QUEUE.PREFIX + user, // KEYS[1], the key of the queue
        QUEUE.INDEX, // KEYS[2], the key of the index
        user // ARGV[1] - value of the element to remove from the index
    ];

    this.metadataBackend.redisCmd(QUEUE.DB, 'EVAL', redisParams, function (err, jobId) {
        self.logger.debug('JobQueue.dequeued user=%s, jobId=%s', user, jobId);
        return callback(err, jobId);
    });
};

JobQueue.prototype.enqueueFirst = function (user, jobId, callback) {
    this.logger.debug('JobQueue.enqueueFirst user=%s, jobId=%s', user, jobId);
    this.metadataBackend.redisMultiCmd(QUEUE.DB, [
        ['RPUSH', QUEUE.PREFIX + user, jobId],
        ['SADD', QUEUE.INDEX, user]
    ], function (err) {
        if (err) {
            return callback(err);
        }

        this.jobPublisher.publish(user);
        callback();
    }.bind(this));
};

JobQueue.prototype.getQueues = function (callback) {
    this.metadataBackend.redisCmd(QUEUE.DB, 'SMEMBERS', [QUEUE.INDEX], function (err, queues) {
        if (err) {
            return callback(err);
        }

        callback(null, queues);
    });
};

JobQueue.prototype.scanQueues = function (callback) {
    var self = this;

    self.scan(function (err, queues) {
        if (err) {
            return callback(err);
        }

        self.logger.debug('JobQueue.scanQueues found queues=%s', queues.join(', '));
        self.addToQueueIndex(queues, function (err) {
            if (err) {
                return callback(err);
            }

            callback(null, queues);
        });
    });
};

JobQueue.prototype.scan = function (callback) {
    var self = this;
    var initialCursor = ['0'];
    var users = {};

    self._scan(initialCursor, users, function (err, users) {
        if (err) {
            return callback(err);
        }

        callback(null, Object.keys(users));
    });
};

JobQueue.prototype._scan = function (cursor, users, callback) {
    var self = this;
    var redisParams = [cursor[0], 'MATCH', QUEUE.PREFIX + '*'];

    self.metadataBackend.redisCmd(QUEUE.DB, 'SCAN', redisParams, function (err, currentCursor) {
        if (err) {
            return callback(null, users);
        }

        var queues = currentCursor[1];
        if (queues) {
            queues.forEach(function (queue) {
                var user = queue.substr(QUEUE.PREFIX.length);
                users[user] = true;
            });
        }

        var hasMore = currentCursor[0] !== '0';
        if (!hasMore) {
            return callback(null, users);
        }

        self._scan(currentCursor, users, callback);
    });
};

JobQueue.prototype.addToQueueIndex = function (users, callback) {
    var self = this;
    var usersQueues = queueAsync(users.length);

    users.forEach(function (user) {
        usersQueues.defer(function (user, callback) {
            self.metadataBackend.redisCmd(QUEUE.DB, 'SADD', [QUEUE.INDEX, user], callback);
        }, user);
    });

    usersQueues.awaitAll(function (err) {
        if (err) {
            return callback(err);
        }

        callback(null);
    });
};
