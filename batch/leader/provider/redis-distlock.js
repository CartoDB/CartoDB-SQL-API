'use strict';

var REDIS_DISTLOCK = {
    DB: 5,
    PREFIX: 'batch:locks:'
};

var Redlock = require('redlock');
var debug = require('../../util/debug')('redis-distlock');

function RedisDistlockLocker(redisPool) {
    this.pool = redisPool;
    this.redlock = null;
    this.client = null;
    this._locks = {};
}

module.exports = RedisDistlockLocker;
module.exports.type = 'redis-distlock';

function resourceId(host) {
    return REDIS_DISTLOCK.PREFIX + host;
}

RedisDistlockLocker.prototype.lock = function(host, ttl, callback) {
    var self = this;
    debug('RedisDistlockLocker.lock(%s, %d)', host, ttl);
    var resource = resourceId(host);

    var lock = this._getLock(resource);
    function acquireCallback(err, _lock) {
        if (err) {
            return callback(err);
        }
        self._setLock(resource, _lock);
        return callback(null, _lock);
    }
    if (lock) {
        return this._tryExtend(lock, ttl, function(err, _lock) {
            if (err) {
                return self._tryAcquire(resource, ttl, acquireCallback);
            }

            return callback(null, _lock);
        });
    } else {
        return this._tryAcquire(resource, ttl, acquireCallback);
    }
};

RedisDistlockLocker.prototype.unlock = function(host, callback) {
    var lock = this._getLock(resourceId(host));
    if (lock && this.redlock) {
        return this.redlock.unlock(lock, callback);
    }
};

RedisDistlockLocker.prototype._getLock = function(resource) {
    if (this._locks.hasOwnProperty(resource)) {
        return this._locks[resource];
    }
    return null;
};

RedisDistlockLocker.prototype._setLock = function(resource, lock) {
    this._locks[resource] = lock;
};

RedisDistlockLocker.prototype._tryExtend = function(lock, ttl, callback) {
    return lock.extend(ttl, function(err, _lock) {
        return callback(err, _lock);
    });
};

RedisDistlockLocker.prototype._tryAcquire = function(resource, ttl, callback) {
    if (this.redlock & this.client && this.client.connected) {
        return this.redlock.lock(resource, ttl, callback);
    }
    if (this.client && !this.client.connected) {
        this.pool.release(REDIS_DISTLOCK.DB, this.client);
    }
    var self = this;
    this.pool.acquire(REDIS_DISTLOCK.DB, function (err, client) {
        self.client = client;
        self.redlock = new Redlock([client], {
            // see http://redis.io/topics/distlock
            driftFactor: 0.01, // time in ms
            // the max number of times Redlock will attempt to lock a resource before failing
            retryCount: 3,
            // the time in ms between attempts
            retryDelay: 100
        });

        self.redlock.lock(resource, ttl, callback);
    });
};
