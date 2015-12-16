'use strict';

function JobQueueProducer(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.db = 5;
}

JobQueueProducer.prototype.enqueue = function (cdbUsername, host, callback) {
    var db = this.db;
    var queue = 'queue:' + host;

    this.metadataBackend.redisCmd(db, 'LPUSH', [queue, cdbUsername], callback);
};

module.exports = JobQueueProducer;
