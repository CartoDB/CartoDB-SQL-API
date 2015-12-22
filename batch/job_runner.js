'use strict';

var JobBackend = require('./job_backend');
var PSQL = require('cartodb-psql');

function JobRunner(metadataBackend, userDatabaseMetadataService) {
    this.metadataBackend = metadataBackend;
    this.userDatabaseMetadataService = userDatabaseMetadataService;
}

JobRunner.prototype.run = function (jobId) {
    var self = this;
    var jobBackend = new JobBackend(this.metadataBackend);

    jobBackend.get(jobId, function (err, job) {
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
                    query.on('error', function (err) {
                        jobBackend.setFailed(job, err);
                    });

                    query.on('end', function () {
                        jobBackend.setDone(job);
                    });
                });
            });
        });
    });

    return jobBackend;
};


module.exports = JobRunner;
