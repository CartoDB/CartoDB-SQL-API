'use strict';

var RedisPool = require('redis-mpool');
var _ = require('underscore');
var asyncQ = require('queue-async');
var debug = require('../util/debug')('queue-mover');
var forever = require('../util/forever');

var QUEUE = {
    OLD: {
        DB: 5,
        PREFIX: 'batch:queues:' // host
    },
    NEW: {
        DB: 5,
        PREFIX: 'batch:queue:' // user
    }
};

function HostUserQueueMover(jobQueue, jobService, locker, redisConfig) {
    this.jobQueue = jobQueue;
    this.jobService = jobService;
    this.locker = locker;
    this.pool = new RedisPool(_.extend({ name: 'batch-distlock' }, redisConfig));
}

module.exports = HostUserQueueMover;

HostUserQueueMover.prototype.moveOldJobs = function(callback) {
    var self = this;
    this.getOldQueues(function(err, hosts) {
        var async = asyncQ(4);
        hosts.forEach(function(host) {
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

HostUserQueueMover.prototype.moveOldQueueJobs = function(host, callback) {
    var self = this;
    // do forever, it does not throw a stack overflow
    forever(
        function (next) {
            self.locker.lock(host, function(err) {
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

//this.metadataBackend.redisCmd(QUEUE.DB, 'RPOP', [ QUEUE.PREFIX + user ], callback);

HostUserQueueMover.prototype.processNextJob = function (host, callback) {
    var self = this;
    this.pool.acquire(QUEUE.OLD.DB, function(err, client) {
        if (err) {
            return callback(err);
        }

        client.lpop(QUEUE.OLD.PREFIX + host, function(err, jobId) {
            debug('Found jobId=%s at queue=%s', jobId, host);
            if (!jobId) {
                var emptyQueueError = new Error('Empty queue');
                emptyQueueError.name = 'EmptyQueue';
                return callback(emptyQueueError);
            }
            self.pool.release(QUEUE.OLD.DB, client);
            self.jobService.get(jobId, function(err, job) {
                if (err) {
                    debug(err);
                    return callback();
                }
                if (job) {
                    return self.jobQueue.enqueueFirst(job.data.user, jobId, function() {
                        return callback();
                    });
                }
                return callback();
            });
        });
    });
};

HostUserQueueMover.prototype.getOldQueues = function(callback) {
    var initialCursor = ['0'];
    var hosts = {};
    this._getOldQueues(initialCursor, hosts, callback);
};

HostUserQueueMover.prototype._getOldQueues = function (cursor, hosts, callback) {
    var self = this;
    var redisParams = [cursor[0], 'MATCH', QUEUE.OLD.PREFIX + '*'];

    this.pool.acquire(QUEUE.OLD.DB, function(err, client) {
        if (err) {
            return callback(err);
        }

        client.scan(redisParams, function(err, currentCursor) {
            // checks if iteration has ended
            if (currentCursor[0] === '0') {
                self.pool.release(QUEUE.OLD.DB, client);
                return callback(null, Object.keys(hosts));
            }

            var queues = currentCursor[1];

            if (!queues) {
                return callback(null);
            }

            queues.forEach(function (queue) {
                var host = queue.substr(QUEUE.OLD.PREFIX.length);
                hosts[host] = true;
            });

            self._getOldQueues(currentCursor, hosts, callback);
        });
    });
};
