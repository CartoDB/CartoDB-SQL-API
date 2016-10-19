'use strict';

var debug = require('../util/debug')('host-scheduler');
var Scheduler = require('./scheduler');
var Locker = require('../leader/locker');
var InfinityCapacity = require('./capacity/infinity');
//var OneCapacity = require('./capacity/one');

function HostScheduler(name, taskRunner, redisPool) {
    this.name = name || 'scheduler';
    this.taskRunner = taskRunner;
    this.locker = Locker.create('redis-distlock', { pool: redisPool });
    this.locker.on('error', function(err, host) {
        debug('[%s] Locker.error %s', this.name, err.message);
        this.unlock(host);
    }.bind(this));
    // host => Scheduler
    this.schedulers = {};
}

module.exports = HostScheduler;

HostScheduler.prototype.add = function(host, user, callback) {
    this.lock(host, function(err, scheduler) {
        if (err) {
            debug('[%s] Could not lock host=%s', this.name, host);
            return callback(err);
        }
        scheduler.add(user);
        var wasRunning = scheduler.schedule();
        debug('[%s] Scheduler host=%s was running=%s', this.name, host, wasRunning);
        return callback(err, wasRunning);
    }.bind(this));
};

HostScheduler.prototype.lock = function(host, callback) {
    debug('[%s] lock(%s)', this.name, host);
    var self = this;
    this.locker.lock(host, function(err) {
        if (err) {
            debug('[%s] Could not lock host=%s. Reason: %s', self.name, host, err.message);
            return callback(err);
        }

        if (!self.schedulers.hasOwnProperty(host)) {
            var scheduler = new Scheduler(new InfinityCapacity(host), self.taskRunner);
            scheduler.on('done', self.unlock.bind(self, host));
            self.schedulers[host] = scheduler;
        }

        debug('[%s] Locked host=%s', self.name, host);
        return callback(null, self.schedulers[host]);
    });
};

HostScheduler.prototype.unlock = function(host) {
    debug('[%s] unlock(%s)', this.name, host);
    if (this.schedulers.hasOwnProperty(host)) {
        // TODO stop scheduler?
        delete this.schedulers[host];
    }
    this.locker.unlock(host, debug);
};
