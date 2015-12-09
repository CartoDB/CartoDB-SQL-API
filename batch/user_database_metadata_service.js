'use strict';

function UserDatabaseMetadataService(metadataBackend) {
    this.metadataBackend = metadataBackend;
}

UserDatabaseMetadataService.prototype.getUserMetadata = function (username, callback) {
    this.metadataBackend.getAllUserDBParams(username, function (err, userDatabaseMetadata) {
        if (err) {
            return callback(err);
        }

        callback(null, userDatabaseMetadata);
    });
};

module.exports = UserDatabaseMetadataService;
