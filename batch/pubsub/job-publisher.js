'use strict';

var Channel = require('./channel');
var debug = require('./../util/debug')('pubsub:publisher');
var error = require('./../util/debug')('pubsub:publisher:error');

function JobPublisher(pool) {
    this.pool = pool;
}

JobPublisher.prototype.publish = function (host) {
    var self = this;

    this.pool.acquire(Channel.DB, function (err, client) {
        if (err) {
            return error('Error adquiring redis client: ' + err.message);
        }

        client.publish(Channel.NAME, host, function (err) {
            self.pool.release(Channel.DB, client);

            if (err) {
                return error('Error publishing to ' + Channel.NAME + ':' + host + ', ' + err.message);
            }

            debug('publish to ' + Channel.NAME + ':' + host);
        });
    });
};

module.exports = JobPublisher;
