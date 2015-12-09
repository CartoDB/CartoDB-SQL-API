'use strict';

function JobCounterService(maxJobsPerHost, metadataBackend) {
    this.metadataBackend = metadataBackend;
    this.maxJobsPerHost =  maxJobsPerHost || global.settings.max_jobs_per_instance;
    this.db = 5;
}

JobCounterService.prototype.increment = function (host, callback) {
    var self = this;
    var db = this.db;

    this.metadataBackend.redisCmd(db, 'GET', [host], function (err, hostCounter) {
        if (err) {
            return callback(err);
        }

        if (hostCounter >= self.maxJobsPerHost) {
            return callback(new Error('Limit max job per host is reached: %s jobs', hostCounter));
        }

        self.metadataBackend.redisCmd(db, 'INCR', [host], function (err /*, hostCounter */) {
            if (err) {
                return callback(err);
            }
            callback();
        });
    });
};

JobCounterService.prototype.decrement = function (host, callback) {
    var self = this;
    var db = this.db;

    this.metadataBackend.redisCmd(db, 'GET', [host], function (err, hostCounter) {
        if (err) {
            return callback(err);
        }

        if (hostCounter < 0) {
            return callback(new Error('Limit max job per host is reached'));
        }

        self.metadataBackend.redisCmd(db, 'DECR', [host], function (err /*, hostCounter */) {
            if (err) {
                return callback(err);
            }
            callback();
        });
    });
 };

module.exports = JobCounterService;
