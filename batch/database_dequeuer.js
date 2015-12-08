'use strict';

function DatabaseDequeuer(userDatabaseQueue, metadataBackend, jobCounter) {
    this.userDatabaseQueue = userDatabaseQueue;
    this.metadataBackend = metadataBackend;
    this.jobCounter = jobCounter;
}

DatabaseDequeuer.prototype.dequeue = function (callback) {
    var self = this;

    this.userDatabaseQueue.dequeue(function (err, userDatabaseName) {
        if (err) {
            return callback(err);
        }

        if (!userDatabaseName) {
            return callback();
        }

        self.metadataBackend.getAllUserDBParams(userDatabaseName, function (err, userDatabase) {
            console.log('>>>>', userDatabaseName, userDatabase);
            if (err) {
                return callback(err);
            }

            if (this.jobCounter.increment(userDatabase.dbHost)) {
                return callback(null, userDatabase);
            }

            // host is busy, enqueue job again!
            this.userDatabaseQueue.enqueue(userDatabaseName, function (err) {
                if (err) {
                    return callback(err);
                }
                callback();
            });

        });
    });
};

module.exports = DatabaseDequeuer;
