'use strict';

var REDIS_DISTLOCK = {
    DB: global.settings.batch_db || 5,
    PREFIX: 'batch:locks:'
};

var Redlock = require('redlock');
var debug = require('../../util/debug')('leader:redis-distlock');

function RedisDistlockLocker (redisPool) {
    this.pool = redisPool;
    this.redlock = new Redlock([{}], {
        // see http://redis.io/topics/distlock
        driftFactor: 0.01, // time in ms
        // the max number of times Redlock will attempt to lock a resource before failing
        retryCount: 3,
        // the time in ms between attempts
        retryDelay: 100
    });
    this._locks = {};
}

module.exports = RedisDistlockLocker;
module.exports.type = 'redis-distlock';

function resourceId (resource) {
    return REDIS_DISTLOCK.PREFIX + resource;
}

RedisDistlockLocker.prototype.lock = function (resource, ttl, callback) {
    var self = this;
    debug('RedisDistlockLocker.lock(%s, %d)', resource, ttl);
    var lockId = resourceId(resource);

    var lock = this._getLock(lockId);
    function acquireCallback (err, _lock) {
        if (err) {
            return callback(err);
        }
        self._setLock(lockId, _lock);
        return callback(null, _lock);
    }
    if (lock) {
        return this._tryExtend(lock, ttl, function (err, _lock) {
            if (err) {
                return self._tryAcquire(lockId, ttl, acquireCallback);
            }

            return callback(null, _lock);
        });
    } else {
        return this._tryAcquire(lockId, ttl, acquireCallback);
    }
};

RedisDistlockLocker.prototype.unlock = function (resource, callback) {
    var self = this;
    var lock = this._getLock(resourceId(resource));
    if (lock) {
        this.pool.acquire(REDIS_DISTLOCK.DB)
            .then(client => {
                self.redlock.servers = [client];
                self.redlock.unlock(lock, function (err) {
                    self.pool.release(REDIS_DISTLOCK.DB, client)
                        .catch(err => debug(err))
                        .finally(() => err ? callback(err) : callback());
                });
            })
            .catch(err => callback(err));
    }
};

RedisDistlockLocker.prototype._getLock = function (resource) {
    if (Object.prototype.hasOwnProperty.call(this._locks, resource)) {
        return this._locks[resource];
    }
    return null;
};

RedisDistlockLocker.prototype._setLock = function (resource, lock) {
    this._locks[resource] = lock;
};

RedisDistlockLocker.prototype._tryExtend = function (lock, ttl, callback) {
    var self = this;
    this.pool.acquire(REDIS_DISTLOCK.DB)
        .then(client => {
            self.redlock.servers = [client];
            lock.extend(ttl, function (err, _lock) {
                self.pool.release(REDIS_DISTLOCK.DB, client)
                    .catch(err => debug(err))
                    .finally(() => err ? callback(err) : callback(null, _lock));
            });
        })
        .catch(err => callback(err));
};

RedisDistlockLocker.prototype._tryAcquire = function (resource, ttl, callback) {
    var self = this;
    this.pool.acquire(REDIS_DISTLOCK.DB)
        .then(client => {
            self.redlock.servers = [client];
            self.redlock.lock(resource, ttl, function (err, _lock) {
                self.pool.release(REDIS_DISTLOCK.DB, client)
                    .catch(err => debug(err))
                    .finally(() => err ? callback(err) : callback(null, _lock));
            });
        })
        .catch(err => callback(err));
};
