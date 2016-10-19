'use strict';

var debug = require('../util/debug')('host-scheduler');
var Scheduler = require('./scheduler');
var Locker = require('../leader/locker');
var InfinityCapacity = require('./capacity/infinity');
//var OneCapacity = require('./capacity/one');

function HostScheduler(taskRunner, redisPool) {
    this.taskRunner = taskRunner;
    this.locker = Locker.create('redis-distlock', { pool: redisPool });
    this.locker.on('error', function(err, host) {
        debug('Locker.error %s', err.message);
        this.unlock(host);
    }.bind(this));
    // host => Scheduler
    this.schedulers = {};
}

module.exports = HostScheduler;

HostScheduler.prototype.add = function(host, user, callback) {
    this.lock(host, function(err, scheduler) {
        if (err) {
            return callback(err);
        }
        var wasRunning = scheduler.add(user);
        return callback(err, wasRunning);
    });
};

HostScheduler.prototype.lock = function(host, callback) {
    debug('lock(%s)', host);
    var self = this;
    this.locker.lock(host, function(err) {
        if (err) {
            debug('Could not lock host=%s. Reason: %s', host, err.message);
            return callback(err);
        }

        if (!self.schedulers.hasOwnProperty(host)) {
            var scheduler = new Scheduler(new InfinityCapacity(host), self.taskRunner);
            scheduler.on('done', self.unlock.bind(self, host));
            self.schedulers[host] = scheduler;
        }

        debug('Locked host=%s', host);
        return callback(null, self.schedulers[host]);
    });
};

HostScheduler.prototype.unlock = function(host) {
    debug('unlock(%s)', host);
    if (this.schedulers.hasOwnProperty(host)) {
        // TODO stop scheduler?
        delete this.schedulers[host];
    }
    this.locker.unlock(host, debug);
};
