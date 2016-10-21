'use strict';

var Channel = require('./channel');
var QueueSeeker = require('./queue-seeker');
var debug = require('./../util/debug')('pubsub:subscriber');
var error = require('./../util/debug')('pubsub:subscriber:error');

var MINUTE = 60 * 1000;
var SUBSCRIBE_INTERVAL = 5 * MINUTE;

function JobSubscriber(pool, userDatabaseMetadataService) {
    this.pool = pool;
    this.userDatabaseMetadataService = userDatabaseMetadataService;
    this.queueSeeker = new QueueSeeker(pool);
}

module.exports = JobSubscriber;

function seeker(queueSeeker, onJobHandler, callback) {
    queueSeeker.seek(function (err, users) {
        if (err) {
            if (callback) {
                callback(err);
            }
            return error(err);
        }
        debug('queues found successfully');
        users.forEach(onJobHandler);

        if (callback) {
            return callback(null);
        }
    });
}

JobSubscriber.prototype.subscribe = function (onJobHandler, callback) {
    var self = this;

    function wrappedJobHandlerListener(user) {
        self.userDatabaseMetadataService.getUserMetadata(user, function (err, userDatabaseMetadata) {
            if (err) {
                return callback(err);
            }
            return onJobHandler(user, userDatabaseMetadata.host);
        });
    }

    seeker(this.queueSeeker, wrappedJobHandlerListener, function(err) {
        if (callback) {
            callback(err);
        }

        // do not start any pooling until first seek has finished
        self.seekerInterval = setInterval(seeker, SUBSCRIBE_INTERVAL, self.queueSeeker, wrappedJobHandlerListener);

        self.pool.acquire(Channel.DB, function (err, client) {
            if (err) {
                return error('Error adquiring redis client: ' + err.message);
            }

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
        });
    });
};

JobSubscriber.prototype.unsubscribe = function (callback) {
    clearInterval(this.seekerInterval);
    if (this.client && this.client.connected) {
        this.client.unsubscribe(Channel.NAME, callback);
    } else {
        if (callback) {
            return callback(null);
        }
    }
};
