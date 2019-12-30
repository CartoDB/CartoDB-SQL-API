'use strict';

function UserDatabaseMetadataService (metadataBackend) {
    this.metadataBackend = metadataBackend;
}

UserDatabaseMetadataService.prototype.getUserMetadata = function (username, callback) {
    var self = this;

    this.metadataBackend.getAllUserDBParams(username, function (err, userDatabaseMetadata) {
        if (err) {
            return callback(err);
        }

        callback(null, self.parseMetadataToDatabase(userDatabaseMetadata));
    });
};

UserDatabaseMetadataService.prototype.parseMetadataToDatabase = function (userDatabaseMetadata) {
    var dbParams = userDatabaseMetadata;

    var dbopts = {};

    dbopts.port = dbParams.dbport || global.settings.db_batch_port || global.settings.db_port;
    dbopts.host = dbParams.dbhost;
    dbopts.dbname = dbParams.dbname;

    return dbopts;
};

module.exports = UserDatabaseMetadataService;
