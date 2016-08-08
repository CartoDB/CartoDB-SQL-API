'use strict';

function JobQueue(metadataBackend, jobPublisher) {
    this.metadataBackend = metadataBackend;
    this.jobPublisher = jobPublisher;
    this.db = 5;
    this.redisPrefix = 'batch:queues:';
}

JobQueue.prototype.enqueue = function (job_id, host, callback) {
    var self = this;

    this.metadataBackend.redisCmd(this.db, 'LPUSH', [ this.redisPrefix + host, job_id ], function (err) {
        if (err) {
            return callback(err);
        }

        self.jobPublisher.publish(host);
        callback();
    });
};

JobQueue.prototype.dequeue = function (host, callback) {
    this.metadataBackend.redisCmd(this.db, 'RPOP', [ this.redisPrefix + host ], callback);
};

JobQueue.prototype.enqueueFirst = function (job_id, host, callback) {
    this.metadataBackend.redisCmd(this.db, 'RPUSH', [ this.redisPrefix + host, job_id ], callback);
};

module.exports = JobQueue;
