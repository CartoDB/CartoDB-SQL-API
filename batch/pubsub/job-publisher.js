'use strict';

var debug = require('./../util/debug')('pubsub:publisher');
var error = require('./../util/debug')('pubsub:publisher:error');

var DB = 0;

function JobPublisher(pool) {
    this.pool = pool;
    this.channel = 'batch:hosts';
}

JobPublisher.prototype.publish = function (host) {
    var self = this;

    this.pool.acquire(DB, function (err, client) {
        if (err) {
            return error('Error adquiring redis client: ' + err.message);
        }

        client.publish(self.channel, host, function (err) {
            if (err) {
                return error('Error publishing to ' + self.channel + ':' + host + ', ' + err.message);
            }

            debug('publish to ' + self.channel + ':' + host);
            self.pool.release(DB, client);
        });
    });
};

module.exports = JobPublisher;
