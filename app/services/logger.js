'use strict';

const bunyan = require('bunyan');

class Logger {
    constructor (path, name) {
        const stream = {
            level: process.env.NODE_ENV === 'test' ? 'fatal' : 'info'
        };

        if (path) {
            stream.path = path;
        } else {
            stream.stream = process.stdout;
        }

        this.path = path;
        this.logger = bunyan.createLogger({
            name,
            streams: [stream]
        });
    }

    info (log, message) {
        this.logger.info(log, message);
    }

    warn (log, message) {
        this.logger.warn(log, message);
    }
}
 
module.exports = Logger;
