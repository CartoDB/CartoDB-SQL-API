'use strict';

var asyncQ = require('queue-async');
var debug = require('../util/debug')('queue-mover');
var forever = require('../util/forever');

var QUEUE = {
    OLD: {
        DB: global.settings.batch_db || 5,
        PREFIX: 'batch:queues:' // host
    },
    NEW: {
        DB: global.settings.batch_db || 5,
        PREFIX: 'batch:queue:' // user
    }
};

function HostUserQueueMover (jobQueue, jobService, locker, redisPool) {
    this.jobQueue = jobQueue;
    this.jobService = jobService;
    this.locker = locker;
    this.pool = redisPool;
}

module.exports = HostUserQueueMover;

HostUserQueueMover.prototype.moveOldJobs = function (callback) {
    var self = this;
    this.getOldQueues(function (err, hosts) {
        if (err) {
            return callback(err);
        }
        var async = asyncQ(4);
        hosts.forEach(function (host) {
            async.defer(self.moveOldQueueJobs.bind(self), host);
        });

        async.awaitAll(function (err) {
            if (err) {
                debug('Something went wrong moving jobs', err);
            } else {
                debug('Finished moving all jobs');
            }

            callback();
        });
    });
};

HostUserQueueMover.prototype.moveOldQueueJobs = function (host, callback) {
    var self = this;
    // do forever, it does not throw a stack overflow
    forever(
        function (next) {
            self.locker.lock(host, function (err) {
                // we didn't get the lock for the host
                if (err) {
                    debug('Could not lock host=%s. Reason: %s', host, err.message);
                    return next(err);
                }
                debug('Locked host=%s', host);
                self.processNextJob(host, next);
            });
        },
        function (err) {
            if (err) {
                debug(err.name === 'EmptyQueue' ? err.message : err);
            }
            self.locker.unlock(host, callback);
        }
    );
};

// this.metadataBackend.redisCmd(QUEUE.DB, 'RPOP', [ QUEUE.PREFIX + user ], callback);

HostUserQueueMover.prototype.processNextJob = function (host, callback) {
    var self = this;
    this.pool.acquire(QUEUE.OLD.DB)
        .then(client => {
            client.lpop(QUEUE.OLD.PREFIX + host, function (err, jobId) {
                self.pool.release(QUEUE.OLD.DB, client)
                    .then(() => {
                        if (err) {
                            return callback(err);
                        }

                        debug('Found jobId=%s at queue=%s', jobId, host);
                        if (!jobId) {
                            var emptyQueueError = new Error('Empty queue');
                            emptyQueueError.name = 'EmptyQueue';
                            return callback(emptyQueueError);
                        }
                        self.jobService.get(jobId, function (err, job) {
                            if (err) {
                                debug(err);
                                return callback();
                            }
                            if (job) {
                                return self.jobQueue.enqueueFirst(job.data.user, jobId, function () {
                                    return callback();
                                });
                            }
                            return callback();
                        });
                    })
                    .catch(err => callback(err));
            });
        })
        .catch(err => callback(err));
};

HostUserQueueMover.prototype.getOldQueues = function (callback) {
    var initialCursor = ['0'];
    var hosts = {};
    var self = this;

    this.pool.acquire(QUEUE.OLD.DB)
        .then(client => {
            self._getOldQueues(client, initialCursor, hosts, function (err, hosts) {
                self.pool.release(QUEUE.DB, client)
                    .then(() => err ? callback(err) : callback(null, Object.keys(hosts)))
                    .catch(err => callback(err));
            });
        })
        .catch(err => callback(err));
};

HostUserQueueMover.prototype._getOldQueues = function (client, cursor, hosts, callback) {
    var self = this;
    var redisParams = [cursor[0], 'MATCH', QUEUE.OLD.PREFIX + '*'];

    client.scan(redisParams, function (err, currentCursor) {
        if (err) {
            return callback(null, hosts);
        }

        var queues = currentCursor[1];
        if (queues) {
            queues.forEach(function (queue) {
                var user = queue.substr(QUEUE.OLD.PREFIX.length);
                hosts[user] = true;
            });
        }

        var hasMore = currentCursor[0] !== '0';
        if (!hasMore) {
            return callback(null, hosts);
        }

        self._getOldQueues(client, currentCursor, hosts, callback);
    });
};
