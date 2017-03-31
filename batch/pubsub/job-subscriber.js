'use strict';

var Channel = require('./channel');
var queueDiscover = require('./queue-discover');
var debug = require('./../util/debug')('pubsub:subscriber');
var error = require('./../util/debug')('pubsub:subscriber:error');

var MINUTE = 60 * 1000;
var SUBSCRIBE_INTERVAL = 5 * MINUTE;

function JobSubscriber(pool, userDatabaseMetadataService) {
    this.pool = pool;
    this.userDatabaseMetadataService = userDatabaseMetadataService;
}

module.exports = JobSubscriber;

JobSubscriber.prototype.subscribe = function (onJobHandler, callback) {
    var self = this;

    function wrappedJobHandlerListener(user) {
        self.userDatabaseMetadataService.getUserMetadata(user, function (err, userDatabaseMetadata) {
            if (err) {
                if (callback) {
                    callback(err);
                }
                return error('Error getting user\'s host: ' + err.message);
            }
            return onJobHandler(user, userDatabaseMetadata.host);
        });
    }

    queueDiscover(self.pool, wrappedJobHandlerListener, function (err, client) {
        if (err) {
            if (callback) {
                callback(err);
            }

            return error('Error discovering user\'s queues: ' + err.message);
        }

        // do not start any pooling until first seek has finished
        self.discoverInterval = setInterval(queueDiscover, SUBSCRIBE_INTERVAL, self.pool, wrappedJobHandlerListener);

        self.client = client;
        client.removeAllListeners('message');
        client.unsubscribe(Channel.NAME);
        client.subscribe(Channel.NAME);

        client.on('message', function (channel, user) {
            debug('message received in channel=%s from user=%s', channel, user);
            wrappedJobHandlerListener(user);
        });

        client.on('error', function () {
            self.unsubscribe();
            self.pool.release(Channel.DB, client);
            self.subscribe(onJobHandler);
        });

        if (callback) {
            callback();
        }
    });
};

JobSubscriber.prototype.unsubscribe = function (callback) {
    clearInterval(this.discoverInterval);
    if (this.client && this.client.connected) {
        this.client.unsubscribe(Channel.NAME, callback);
    } else {
        if (callback) {
            return callback(null);
        }
    }
};
