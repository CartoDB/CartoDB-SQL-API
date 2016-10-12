'use strict';

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
    var self = this;

    this.metadataBackend.redisCmd(QUEUE.DB, 'LPUSH', [ QUEUE.PREFIX + user, jobId ], function (err) {
        if (err) {
            return callback(err);
        }

        self.jobPublisher.publish(user);
        callback();
    });
};

JobQueue.prototype.size = function (user, callback) {
    this.metadataBackend.redisCmd(QUEUE.DB, 'LLEN', [ QUEUE.PREFIX + user ], callback);
};

JobQueue.prototype.dequeue = function (user, callback) {
    this.metadataBackend.redisCmd(QUEUE.DB, 'RPOP', [ QUEUE.PREFIX + user ], callback);
};

JobQueue.prototype.enqueueFirst = function (user, jobId, callback) {
    this.metadataBackend.redisCmd(QUEUE.DB, 'RPUSH', [ QUEUE.PREFIX + user, jobId ], callback);
};
