'use strict';

var _ = require('underscore');

function UserDatabaseMetadataService(metadataBackend) {
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

//TODO AUTH is (all of) this necessary?
UserDatabaseMetadataService.prototype.parseMetadataToDatabase = function (userDatabaseMetadata) {
    var dbParams = userDatabaseMetadata;

    var dbopts = {};

    dbopts.pass = dbParams.dbpass || global.settings.db_pubuser_pass;
    dbopts.port = dbParams.dbport || global.settings.db_batch_port || global.settings.db_port;
    dbopts.host = dbParams.dbhost;
    dbopts.dbname = dbParams.dbname;
    dbopts.user = (!!dbParams.dbpublicuser) ? dbParams.dbpublicuser : global.settings.db_pubuser;

    // batch is secure so it's going to be authenticated by default
    dbopts.authenticated = true;
    dbopts.user = _.template(global.settings.db_user, { user_id: dbParams.dbuser });

    dbopts.pass = _.template(global.settings.db_user_pass, {
        user_id: dbParams.dbuser,
        user_password: dbParams.dbpass
    });

    return dbopts;
};

module.exports = UserDatabaseMetadataService;
