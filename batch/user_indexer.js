'use strict';

function UserIndexer(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.db = 5;
    this.redisPrefix = 'batch:users:';
}

UserIndexer.prototype.add = function (username, job_id, callback) {
    this.metadataBackend.redisCmd(this.db, 'RPUSH', [ this.redisPrefix + username, job_id ] , callback);
};

UserIndexer.prototype.list = function (username, callback) {
    this.metadataBackend.redisCmd(this.db, 'LRANGE', [ this.redisPrefix + username, -100, -1 ] , callback);
};

UserIndexer.prototype.remove = function (username, job_id, callback) {
    this.metadataBackend.redisCmd(this.db, 'LREM', [ this.redisPrefix + username, 0, job_id] , callback);
};

module.exports = UserIndexer;
