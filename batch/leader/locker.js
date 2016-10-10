'use strict';

var _ = require('underscore');
var RedisPool = require('redis-mpool');
var RedisDistlockLocker = require('./provider/redis-distlock');
var debug = require('../util/debug')('leader-locker');

function Locker(locker) {
    this.locker = locker;
}

module.exports = Locker;

Locker.prototype.lock = function(host, ttl, callback) {
    debug('Locker.lock(%s, %d)', host, ttl);
    this.locker.lock(host, ttl, callback);
};

Locker.prototype.unlock = function(host, callback) {
    debug('Locker.unlock(%s)', host);
    this.locker.unlock(host, callback);
};

module.exports.create = function createLocker(type, config) {
    if (type !== 'redis-distlock') {
        throw new Error('Invalid type Locker type. Valid types are: "redis-distlock"');
    }
    var redisPool = new RedisPool(_.extend({ name: 'batch-distlock' }, config.redisConfig));
    var locker = new RedisDistlockLocker(redisPool);
    return new Locker(locker);
};
