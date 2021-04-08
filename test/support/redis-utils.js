'use strict';

var RedisPool = require('redis-mpool');

var redisConfig = {
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
};
var metadataBackend = require('cartodb-redis')(redisConfig);

module.exports.clean = function clean (db, pattern, callback) {
    metadataBackend.redisCmd(db, 'KEYS', [pattern], function (err, keys) {
        if (err) {
            return callback(err);
        }

        if (!keys || !keys.length) {
            return callback();
        }

        metadataBackend.redisCmd(db, 'DEL', keys, callback);
    });
};

module.exports.getConfig = function getConfig () {
    return redisConfig;
};

var pool = new RedisPool(redisConfig);
module.exports.getPool = function getPool () {
    return pool;
};

module.exports.configureUserMetadata = function configureUserMetadata (action, params, callback) {
    metadataBackend.redisCmd(5, action, params, callback);
};
