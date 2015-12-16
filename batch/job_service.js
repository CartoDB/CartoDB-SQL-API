'use strict';

function JobService(userDatabaseMetadataService, job) {
    this.userDatabaseMetadataService = userDatabaseMetadataService;
    this.job = job;
}

JobService.prototype.run = function (username, callback) {
    var self = this;

    this.userDatabaseMetadataService.getUserMetadata(username, function (err, userDatabaseMetadata) {
        if (err) {
            return callback(err);
        }

        self.job.run(userDatabaseMetadata, callback);
    });
};

module.exports = JobService;