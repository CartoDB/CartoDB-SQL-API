'use strict';

function JobQueue(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.db = 5;
}

JobQueue.prototype.enqueue = function (job_id, host, callback) {
    var db = this.db;
    var queue = 'queue:' + host;

    this.metadataBackend.redisCmd(db, 'LPUSH', [queue, job_id], callback);
};

JobQueue.prototype.dequeue = function (host, callback) {
    var db = this.db;
    var queue = 'queue:' + host;

    this.metadataBackend.redisCmd(this.db, 'RPOP', [ queue ], callback);
};

module.exports = JobQueue;
