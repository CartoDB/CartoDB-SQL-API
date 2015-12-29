'use strict';

function JobQueue(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.db = 5;
    this.prefixRedis = 'batch:queues:';
}

JobQueue.prototype.enqueue = function (job_id, host, callback) {
    this.metadataBackend.redisCmd(this.db, 'LPUSH', [ this.prefixRedis + host, job_id ], callback);
};

JobQueue.prototype.dequeue = function (host, callback) {
    this.metadataBackend.redisCmd(this.db, 'RPOP', [ this.prefixRedis + host ], callback);
};

module.exports = JobQueue;
