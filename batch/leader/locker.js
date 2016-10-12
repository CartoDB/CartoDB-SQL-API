'use strict';

var _ = require('underscore');
var RedisPool = require('redis-mpool');
var RedisDistlockLocker = require('./provider/redis-distlock');
var debug = require('../util/debug')('leader-locker');

var LOCK = {
    TTL: 5000
};

function Locker(locker, ttl) {
    this.locker = locker;
    this.ttl = (Number.isFinite(ttl) && ttl > 0) ? ttl : LOCK.TTL;
    this.renewInterval = this.ttl / 5;
    this.intervalIds = {};
}

module.exports = Locker;

Locker.prototype.lock = function(host, callback) {
    var self = this;
    debug('Locker.lock(%s, %d)', host, this.ttl);
    this.locker.lock(host, this.ttl, function (err, lock) {
        self.startRenewal(host);
        return callback(err, lock);
    });
};

Locker.prototype.unlock = function(host, callback) {
    var self = this;
    debug('Locker.unlock(%s)', host);
    this.locker.unlock(host, function(err) {
        self.stopRenewal(host);
        return callback(err);
    });
};

Locker.prototype.startRenewal = function(host) {
    var self = this;
    if (!this.intervalIds.hasOwnProperty(host)) {
        this.intervalIds[host] = setInterval(function() {
            debug('Trying to extend lock host=%s', host);
            self.locker.lock(host, self.ttl, function(err, _lock) {
                if (err) {
                    return self.stopRenewal(host);
                }
                if (_lock) {
                    debug('Extended lock host=%s', host);
                }
            });
        }, this.renewInterval);
    }
};

Locker.prototype.stopRenewal = function(host) {
    if (this.intervalIds.hasOwnProperty(host)) {
        clearInterval(this.intervalIds[host]);
        delete this.intervalIds[host];
    }
};

module.exports.create = function createLocker(type, config) {
    if (type !== 'redis-distlock') {
        throw new Error('Invalid type Locker type. Valid types are: "redis-distlock"');
    }
    var redisPool = new RedisPool(_.extend({ name: 'batch-distlock' }, config.redisConfig));
    var locker = new RedisDistlockLocker(redisPool);
    return new Locker(locker, config.ttl);
};
