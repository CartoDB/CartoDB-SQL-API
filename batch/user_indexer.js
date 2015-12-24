'use strict';

function UserIndexer(metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.db = 5;
}

UserIndexer.prototype.add = function (username, job_id, callback) {
    this.metadataBackend.redisCmd(this.db, 'SADD', [username, job_id] , function (err) {
        if (err) {
            return callback(err);
        }
        callback();
    });
};

UserIndexer.prototype.list = function (username, callback) {
    this.metadataBackend.redisCmd(this.db, 'SMEMBERS', [username] , function (err, job_ids) {
        if (err) {
            return callback(err);
        }
        callback(null, job_ids);
    });
};

module.exports = UserIndexer;
