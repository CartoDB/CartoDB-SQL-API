'use strict';

var bunyan = require('bunyan');

function BatchLogger (path) {
    var stream = {
        level: 'info'
    };
    if (path) {
        stream.path = path;
    } else {
        stream.stream = process.stdout;
    }
    this.path = path;
    this.logger = bunyan.createLogger({
        name: 'batch-queries',
        streams: [stream]
    });
}

module.exports = BatchLogger;

BatchLogger.prototype.log = function (job) {
    return job.log(this.logger);
};

BatchLogger.prototype.reopenFileStreams = function () {
    this.logger.reopenFileStreams();
};
