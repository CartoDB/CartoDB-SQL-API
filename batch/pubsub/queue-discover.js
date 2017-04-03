'use strict';

var error = require('./../util/debug')('pubsub:queue-discover:error');
var QUEUE = require('../job_queue').QUEUE;
var queueAsync = require('queue-async');

module.exports = function queueDiscover (pool, wrappedJobHandlerListener, callback) {
    pool.acquire(QUEUE.DB, function (err, client) {
        if (err) {
            if (callback) {
                callback(err);
            }
            return error('Error adquiring redis client: ' + err.message);
        }

        client.smembers(QUEUE.INDEX, function (err, queues) {
            if (err) {
                return error('Error getting queues from index: ' + err.message);
            }

            queues.forEach(wrappedJobHandlerListener);

            if (callback) {
                return callback(null, client, queues);
            }
        });
    });
};

module.exports.startupQueueDiscover = function startupQueueDiscover (pool, callback) {
    var initialCursor = ['0'];
    var users = {};

    pool.acquire(QUEUE.DB, function(err, client) {
        if (err) {
            return callback(err);
        }

        scanQueues(client, initialCursor, users, function(err, users) {
            var usernames = Object.keys(users);
            var usersQueues = queueAsync(usernames.length);

            usernames.forEach(function (username) {
                usersQueues.defer(client.sadd.bind(client), QUEUE.INDEX, username);
            });

            usersQueues.awaitAll(function (err) {
                if (err) {
                    return callback(err);
                }

                pool.release(QUEUE.DB, client);
                callback(null);
            });
        });
    });
};

function scanQueues (client, cursor, users, callback) {
    var redisParams = [cursor[0], 'MATCH', QUEUE.PREFIX + '*'];

    client.scan(redisParams, function(err, currentCursor) {
        if (err) {
            return callback(null, users);
        }

        var queues = currentCursor[1];
        if (queues) {
            queues.forEach(function (queue) {
                var user = queue.substr(QUEUE.PREFIX.length);
                users[user] = true;
            });
        }

        var hasMore = currentCursor[0] !== '0';
        if (!hasMore) {
            return callback(null, users);
        }

        scanQueues(client, currentCursor, users, callback);
    });
}
