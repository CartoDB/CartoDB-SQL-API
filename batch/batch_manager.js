'use strict';

function BatchManager(usernameQueue, userDatabaseMetadataService, jobService, jobCounterService) {
    this.usernameQueue = usernameQueue;
    this.userDatabaseMetadataService = userDatabaseMetadataService;
    this.jobService = jobService;
    this.jobCounterService = jobCounterService;
}

BatchManager.prototype.run = function (callback) {
    var self = this;

    this.usernameQueue.dequeue(function (err, username) {
        if (err) {
            return callback(err);
        }

        if (!username) {
            return callback(new Error('No jobs scheduled'));
        }

        self.userDatabaseMetadataService.getUserMetadata(username, function (err, userDatabaseMetadata) {
            if (err) {
                return callback(err);
            }

            self.jobCounterService.increment(userDatabaseMetadata.host, function (err) {
                if (err) {
                    return callback(err);
                }

                self.jobService.run(userDatabaseMetadata, function (err) {
                    if (err) {
                        callback(err);
                        self.usernameQueue.enqueue(username, function (err) {
                            if (err) {
                                callback(err);
                            }
                        });
                    }

                    self.jobCounterService.decrement(userDatabaseMetadata.host, function (err) {
                        if (err) {
                            return callback(err);
                        }
                        callback();
                    });
                });
            });
        });
    });
};

module.exports = BatchManager;
