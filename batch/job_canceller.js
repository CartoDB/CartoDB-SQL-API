'use strict';

var JobBackend = require('./job_backend');
var PSQL = require('cartodb-psql');
var JobPublisher = require('./job_publisher');
var JobQueue = require('./job_queue');
var UserIndexer = require('./user_indexer');

function JobCanceller(metadataBackend, userDatabaseMetadataService) {
    this.metadataBackend = metadataBackend;
    this.userDatabaseMetadataService = userDatabaseMetadataService;
}

JobCanceller.prototype.cancel = function (job_id) {
    var self = this;
    var jobQueue =  new JobQueue(this.metadataBackend);
    var jobPublisher = new JobPublisher();
    var userIndexer = new UserIndexer(this.metadataBackend);
    var jobBackend = new JobBackend(this.metadataBackend, jobQueue, jobPublisher, userIndexer);

    jobBackend.get(job_id, function (err, job) {
        if (err) {
            return jobBackend.emit('error', err);
        }

        if (job.status === 'pending') {
            return jobBackend.setCancelled(job);
        }

        if (job.status !== 'running') {
            return jobBackend.emit('error', new Error('Job is ' + job.status + ' nothing to do'));
        }

        self.userDatabaseMetadataService.getUserMetadata(job.user, function (err, userDatabaseMetadata) {
            if (err) {
                return jobBackend.emit('error', err);
            }

            var pg = new PSQL(userDatabaseMetadata, {}, { destroyOnError: true });

            var getPIDQuery = 'SELECT pid FROM pg_stat_activity WHERE query = \'' +
                job.query +
                ' /* ' + job.job_id + ' */\'';

            pg.query(getPIDQuery, function(err, result) {
                if(err) {
                    return jobBackend.emit('error', err);
                }

                if (!result.rows[0] || !result.rows[0].pid) {
                    return jobBackend.emit('error', new Error('Query not running currently'));
                }

                var pid = result.rows[0].pid;
                var cancelQuery = 'SELECT pg_cancel_backend(' + pid +')';

                pg.query(cancelQuery, function (err, result) {
                    if (err) {
                        return jobBackend.emit('error', err);
                    }

                    var isCancelled = result.rows[0].pg_cancel_backend;

                    if (!isCancelled) {
                        return jobBackend.emit('error', new Error('Query has not been cancelled'));
                    }

                    jobBackend.emit('cancelled', job);
                });
            });
        });
    });

    return jobBackend;
};


module.exports = JobCanceller;
