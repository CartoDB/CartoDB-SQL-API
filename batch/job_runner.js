'use strict';

var JobBackend = require('./job_backend');
var PSQL = require('cartodb-psql');
var JobPublisher = require('./job_publisher');
var JobQueue = require('./job_queue');
var UserIndexer = require('./user_indexer');

function JobRunner(metadataBackend, userDatabaseMetadataService) {
    this.metadataBackend = metadataBackend;
    this.userDatabaseMetadataService = userDatabaseMetadataService;
}

JobRunner.prototype.run = function (job_id) {
    var self = this;
    var jobQueue =  new JobQueue(this.metadataBackend);
    var jobPublisher = new JobPublisher();
    var userIndexer = new UserIndexer(this.metadataBackend);
    var jobBackend = new JobBackend(this.metadataBackend, jobQueue, jobPublisher, userIndexer);

    jobBackend.get(job_id, function (err, job) {
        if (err) {
            return jobBackend.emit('error', err);
        }

        self.userDatabaseMetadataService.getUserMetadata(job.user, function (err, userDatabaseMetadata) {
            if (err) {
                return jobBackend.emit('error', err);
            }

            var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });

            jobBackend.setRunning(job);

            pg.query('SET statement_timeout=0', function(err) {
                if(err) {
                    return jobBackend.setFailed(job, err);
                }

                pg.eventedQuery(job.query, function (err, query /* , queryCanceller */) {
                    if (err) {
                        return jobBackend.setFailed(job, err);
                    }

                    query.on('error', function (err) {
                        jobBackend.setFailed(job, err);
                    });

                    query.on('end', function (result) {
                        if (result) {
                            jobBackend.setDone(job);
                        }
                    });
                });
            });
        });
    });

    return jobBackend;
};


module.exports = JobRunner;
