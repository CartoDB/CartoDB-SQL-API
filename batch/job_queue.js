'use strict';

function JobQueue(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.db = 5;
    this.redisPrefix = 'batch:queues:';
}

JobQueue.prototype.enqueue = function (job_id, host, callback) {
    this.metadataBackend.redisCmd(this.db, 'LPUSH', [ this.redisPrefix + host, job_id ], callback);
};

JobQueue.prototype.dequeue = function (host, callback) {
    this.metadataBackend.redisCmd(this.db, 'RPOP', [ this.redisPrefix + host ], callback);
};

module.exports = JobQueue;
