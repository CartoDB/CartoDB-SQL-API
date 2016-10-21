'use strict';

var debug = require('./util/debug')('queue');

function JobQueue(metadataBackend, jobPublisher) {
    this.metadataBackend = metadataBackend;
    this.jobPublisher = jobPublisher;
}

module.exports = JobQueue;

var QUEUE = {
    DB: 5,
    PREFIX: 'batch:queue:'
};
module.exports.QUEUE = QUEUE;

JobQueue.prototype.enqueue = function (user, jobId, callback) {
    debug('JobQueue.enqueue user=%s, jobId=%s', user, jobId);
    this.metadataBackend.redisCmd(QUEUE.DB, 'LPUSH', [ QUEUE.PREFIX + user, jobId ], function (err) {
        if (err) {
            return callback(err);
        }

        this.jobPublisher.publish(user);
        callback();
    }.bind(this));
};

JobQueue.prototype.size = function (user, callback) {
    this.metadataBackend.redisCmd(QUEUE.DB, 'LLEN', [ QUEUE.PREFIX + user ], callback);
};

JobQueue.prototype.dequeue = function (user, callback) {
    this.metadataBackend.redisCmd(QUEUE.DB, 'RPOP', [ QUEUE.PREFIX + user ], function(err, jobId) {
        debug('JobQueue.dequeued user=%s, jobId=%s', user, jobId);
        return callback(err, jobId);
    });
};

JobQueue.prototype.enqueueFirst = function (user, jobId, callback) {
    debug('JobQueue.enqueueFirst user=%s, jobId=%s', user, jobId);
    this.metadataBackend.redisCmd(QUEUE.DB, 'RPUSH', [ QUEUE.PREFIX + user, jobId ], callback);
};
