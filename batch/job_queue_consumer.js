'use strict';

var util = require('util');
var Readable = require('stream').Readable;

function JobQueueConsumer(metadataBackend, host) {
    Readable.call(this, {
        encoding: 'utf8',
        objectMode: true
    });
    this.db = 5;
    this.queueName = 'queue:' + host;
    this.metadataBackend = metadataBackend;
}
util.inherits(JobQueueConsumer, Readable);

JobQueueConsumer.prototype._read = function () {
    var self = this;
    this.metadataBackend.redisCmd(this.db, 'RPOP', [ this.queueName ], function (err, username) {
        if (err) {
            return self.emit('error', err);
        }

        self.push(username);
    });
};

module.exports = JobQueueConsumer;
