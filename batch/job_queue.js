'use strict';

function JobQueue(metadataBackend, jobPublisher) {
    this.metadataBackend = metadataBackend;
    this.jobPublisher = jobPublisher;
}

module.exports = JobQueue;

var QUEUE = {
    DB: 5,
    PREFIX: 'batch:queues:'
};
module.exports.QUEUE = QUEUE;

JobQueue.prototype.enqueue = function (job_id, host, callback) {
    var self = this;

    this.metadataBackend.redisCmd(QUEUE.DB, 'LPUSH', [ QUEUE.PREFIX + host, job_id ], function (err) {
        if (err) {
            return callback(err);
        }

        self.jobPublisher.publish(host);
        callback();
    });
};

JobQueue.prototype.dequeue = function (host, callback) {
    this.metadataBackend.redisCmd(QUEUE.DB, 'RPOP', [ QUEUE.PREFIX + host ], callback);
};

JobQueue.prototype.enqueueFirst = function (job_id, host, callback) {
    this.metadataBackend.redisCmd(QUEUE.DB, 'RPUSH', [ QUEUE.PREFIX + host, job_id ], callback);
};
