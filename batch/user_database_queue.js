'use strict';

var RedisPool = require("redis-mpool");
var _ = require('underscore');

function UserDatabaseQueue(poolOptions) {
    poolOptions = poolOptions || {};
    var defaults = {
        slowQueries: {
            log: false,
            elapsedThreshold: 25
        }
    };

    var options = _.defaults(poolOptions, defaults);

    this.redisPool = (options.pool) ?
        poolOptions.pool :
        new RedisPool(_.extend(poolOptions, {
            name: 'userDatabaseQueue',
            db: 12
        }));
    this.poolOptions = poolOptions;
}

UserDatabaseQueue.prototype.enqueue = function (userDatabaseName, callback) {
    var self = this;
    var db = this.poolOptions.db;
    var queue = this.poolOptions.name;

    this.redisPool.acquire(db, function (err, client) {
        if (err) {
            return callback(err);
        }

        client.lpush(queue, [ userDatabaseName ], function (err, userDataName) {
            if (err) {
                return callback(err);
            }
            self.redisPool.release(db, client);
            callback(null, userDataName);
        });
    });
};

UserDatabaseQueue.prototype.dequeue = function (callback) {
    var self = this;
    var db = this.poolOptions.db;
    var queue = this.poolOptions.name;

    this.redisPool.acquire(db, function (err, client) {
        if (err) {
            return callback(err);
        }

        client.rpop(queue, function (err, userDatabaseName) {
            if (err) {
                return callback(err);
            }
            self.redisPool.release(db, client);
            callback(null, userDatabaseName);
        });
    });
};

module.exports = UserDatabaseQueue;
