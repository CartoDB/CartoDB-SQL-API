'use strict';

var bunyan = require('bunyan');
var fs = require('fs');

function BatchLogger (path) {
    this.path = path;
    this.logger = bunyan.createLogger({
        name: 'batch-queries',
        streams: [{
            level: 'info',
            stream: path ? fs.createWriteStream(path, { flags: 'a', encoding: 'utf8' }) :  process.stdout
        }]
    });
}

module.exports = BatchLogger;

BatchLogger.prototype.log = function (job) {
    return job.log(this.logger);
};

BatchLogger.prototype.reopenFileStreams = function () {
    this.logger.reopenFileStreams();
};
