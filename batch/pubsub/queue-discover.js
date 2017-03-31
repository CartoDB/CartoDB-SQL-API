'use strict';

var error = require('./../util/debug')('pubsub:queue-discover:error');
var QUEUE = require('../job_queue').QUEUE;

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
