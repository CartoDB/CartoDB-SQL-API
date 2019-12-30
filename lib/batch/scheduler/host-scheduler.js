'use strict';

var _ = require('underscore');
var debug = require('../util/debug')('host-scheduler');
var Scheduler = require('./scheduler');
var Locker = require('../leader/locker');
var FixedCapacity = require('./capacity/fixed');
var HttpSimpleCapacity = require('./capacity/http-simple');
var HttpLoadCapacity = require('./capacity/http-load');

function HostScheduler (name, taskRunner, redisPool) {
    this.name = name || 'scheduler';
    this.taskRunner = taskRunner;
    this.locker = Locker.create('redis-distlock', { pool: redisPool });
    this.locker.on('error', function (err, host) {
        debug('[%s] Locker.error %s', this.name, err.message);
        this.unlock(host);
    }.bind(this));
    // host => Scheduler
    this.schedulers = {};
}

module.exports = HostScheduler;

HostScheduler.prototype.add = function (host, user, callback) {
    this.lock(host, function (err, scheduler) {
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

HostScheduler.prototype.getCapacityProvider = function (host) {
    var strategy = global.settings.batch_capacity_strategy;

    if (strategy === 'http-simple' || strategy === 'http-load') {
        if (global.settings.batch_capacity_http_url_template) {
            var endpoint = _.template(global.settings.batch_capacity_http_url_template, { dbhost: host });
            debug('Using strategy=%s capacity. Endpoint=%s', strategy, endpoint);

            if (strategy === 'http-simple') {
                return new HttpSimpleCapacity(host, endpoint);
            }
            return new HttpLoadCapacity(host, endpoint);
        }
    }

    var fixedCapacity = global.settings.batch_capacity_fixed_amount || 4;
    debug('Using strategy=fixed capacity=%d', fixedCapacity);
    return new FixedCapacity(fixedCapacity);
};

HostScheduler.prototype.lock = function (host, callback) {
    debug('[%s] lock(%s)', this.name, host);
    var self = this;
    this.locker.lock(host, function (err) {
        if (err) {
            debug('[%s] Could not lock host=%s. Reason: %s', self.name, host, err.message);
            return callback(err);
        }

        if (!Object.prototype.hasOwnProperty.call(self.schedulers, host)) {
            var scheduler = new Scheduler(self.getCapacityProvider(host), self.taskRunner);
            scheduler.on('done', self.unlock.bind(self, host));
            self.schedulers[host] = scheduler;
        }

        debug('[%s] Locked host=%s', self.name, host);
        return callback(null, self.schedulers[host]);
    });
};

HostScheduler.prototype.unlock = function (host) {
    debug('[%s] unlock(%s)', this.name, host);
    if (Object.prototype.hasOwnProperty.call(this.schedulers, host)) {
        // TODO stop scheduler?
        delete this.schedulers[host];
    }
    this.locker.unlock(host, debug);
};
