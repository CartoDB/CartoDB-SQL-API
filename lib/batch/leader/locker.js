'use strict';

var RedisDistlockLocker = require('./provider/redis-distlock');
var debug = require('../util/debug')('leader-locker');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var LOCK = {
    TTL: 5000
};

function Locker (locker, ttl) {
    EventEmitter.call(this);
    this.locker = locker;
    this.ttl = (Number.isFinite(ttl) && ttl > 0) ? ttl : LOCK.TTL;
    this.renewInterval = this.ttl / 5;
    this.intervalIds = {};
}
util.inherits(Locker, EventEmitter);

module.exports = Locker;

Locker.prototype.lock = function (resource, callback) {
    var self = this;
    debug('Locker.lock(%s, %d)', resource, this.ttl);
    this.locker.lock(resource, this.ttl, function (err, lock) {
        if (!err) {
            self.startRenewal(resource);
        }
        return callback(err, lock);
    });
};

Locker.prototype.unlock = function (resource, callback) {
    var self = this;
    debug('Locker.unlock(%s)', resource);
    this.locker.unlock(resource, function (err) {
        self.stopRenewal(resource);
        return callback(err);
    });
};

Locker.prototype.startRenewal = function (resource) {
    var self = this;
    if (!Object.prototype.hasOwnProperty.call(this.intervalIds, resource)) {
        this.intervalIds[resource] = setInterval(function () {
            debug('Trying to extend lock resource=%s', resource);
            self.locker.lock(resource, self.ttl, function (err, _lock) {
                if (err) {
                    self.emit('error', err, resource);
                    return self.stopRenewal(resource);
                }
                if (_lock) {
                    debug('Extended lock resource=%s', resource);
                }
            });
        }, this.renewInterval);
    }
};

Locker.prototype.stopRenewal = function (resource) {
    if (Object.prototype.hasOwnProperty.call(this.intervalIds, resource)) {
        clearInterval(this.intervalIds[resource]);
        delete this.intervalIds[resource];
    }
};

module.exports.create = function createLocker (type, config) {
    if (type !== 'redis-distlock') {
        throw new Error('Invalid type Locker type. Valid types are: "redis-distlock"');
    }
    var locker = new RedisDistlockLocker(config.pool);
    return new Locker(locker, config.ttl);
};
