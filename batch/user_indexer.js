'use strict';

function UserIndexer(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.db = 5;
    this.redisPrefix = 'batch:users:';
}

UserIndexer.prototype.add = function (username, job_id, callback) {
    this.metadataBackend.redisCmd(this.db, 'SADD', [ this.redisPrefix + username, job_id ] , callback);
};

UserIndexer.prototype.list = function (username, callback) {
    this.metadataBackend.redisCmd(this.db, 'SMEMBERS', [ this.redisPrefix + username ] , callback);
};

module.exports = UserIndexer;
