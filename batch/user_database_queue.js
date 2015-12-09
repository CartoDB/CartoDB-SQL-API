'use strict';


function UsernameBatchQueue(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.db = 5;
    this.queueName = 'usernameBatchQueue';
}

UsernameBatchQueue.prototype.enqueue = function (cdbUsername, callback) {
    var db = this.db;
    var queue = this.queueName;

    this.metadataBackend.redisCmd(db, 'LPUSH', [queue, cdbUsername], function (err, cdbUsername) {
        if (err) {
            return callback(err);
        }

        callback(null, cdbUsername);
    });
};

UsernameBatchQueue.prototype.dequeue = function (callback) {
    var db = this.db;
    var queue = this.queueName;

    this.metadataBackend.redisCmd(db, 'RPOP', [queue], function (err, cdbUsername) {
        if (err) {
            return callback(err);
        }

        callback(null, cdbUsername);
    });
};

module.exports = UsernameBatchQueue;
