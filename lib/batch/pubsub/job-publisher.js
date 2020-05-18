'use strict';

var Channel = require('./channel');
var debug = require('./../util/debug')('pubsub:publisher');
var error = require('./../util/debug')('pubsub:publisher:error');

function JobPublisher (pool) {
    this.pool = pool;
}

JobPublisher.prototype.publish = function (user) {
    var self = this;

    this.pool.acquire(Channel.DB)
        .then(client => {
            client.publish(Channel.NAME, user, function (err) {
                self.pool.release(Channel.DB, client)
                    .then(() => {
                        if (err) {
                            return error('Error publishing to ' + Channel.NAME + ':' + user + ', ' + err.message);
                        }

                        debug('publish to ' + Channel.NAME + ':' + user);
                    })
                    .catch(err => error('Error releasing redis client: ' + err.message));
            });
        })
        .catch(err => error('Error adquiring redis client: ' + err.message));
};

module.exports = JobPublisher;
