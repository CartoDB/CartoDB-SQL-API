'use strict';

var Channel = require('./channel');
var debug = require('./../util/debug')('pubsub:subscriber');
var error = require('./../util/debug')('pubsub:subscriber:error');

function JobSubscriber (pool) {
    this.pool = pool;
}

module.exports = JobSubscriber;

JobSubscriber.prototype.subscribe = function (onJobHandler, callback) {
    var self = this;

    self.pool.acquire(Channel.DB)
        .then(client => {
            self.client = client;
            client.removeAllListeners('message');
            client.unsubscribe(Channel.NAME);
            client.subscribe(Channel.NAME);
            client.on('message', function (channel, user) {
                debug('message received in channel=%s from user=%s', channel, user);
                onJobHandler(user);
            });

            client.on('error', function () {
                self.unsubscribe();
                self.pool.release(Channel.DB, client)
                    .catch(err => error('Error releasing redis client: ' + err.message));
                self.subscribe(onJobHandler);
            });

            if (callback) {
                callback();
            }
        })
        .catch(err => {
            error('Error adquiring redis client: ' + err.message);
            if (callback) {
                return callback(err);
            }
        });
};

JobSubscriber.prototype.unsubscribe = function (callback) {
    if (this.client && this.client.connected) {
        this.client.unsubscribe(Channel.NAME, callback);
    } else {
        if (callback) {
            return callback(null);
        }
    }
};
