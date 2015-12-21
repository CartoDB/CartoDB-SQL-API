'use strict';

function JobQueueProducer(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.db = 5;
}

JobQueueProducer.prototype.enqueue = function (jobId, host, callback) {
    var db = this.db;
    var queue = 'queue:' + host;

    this.metadataBackend.redisCmd(db, 'LPUSH', [queue, jobId], callback);
};

module.exports = JobQueueProducer;
