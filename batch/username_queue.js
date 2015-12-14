'use strict';


function UsernameQueue(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.db = 5;
    this.queueName = 'usernameBatchQueue';
}

UsernameQueue.prototype.enqueue = function (cdbUsername, callback) {
    var db = this.db;
    var queue = this.queueName;

    this.metadataBackend.redisCmd(db, 'LPUSH', [queue, cdbUsername], callback);
};

UsernameQueue.prototype.dequeue = function (callback) {
    var db = this.db;
    var queue = this.queueName;

    this.metadataBackend.redisCmd(db, 'RPOP', [queue], callback);
};

module.exports = UsernameQueue;
