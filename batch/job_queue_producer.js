'use strict';

function JobQueueProducer(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.db = 5;
}

JobQueueProducer.prototype.enqueue = function (job_id, host, callback) {
    var db = this.db;
    var queue = 'queue:' + host;

    this.metadataBackend.redisCmd(db, 'LPUSH', [queue, job_id], callback);
};

module.exports = JobQueueProducer;
