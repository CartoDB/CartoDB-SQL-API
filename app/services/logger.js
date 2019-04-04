'use strict';

const bunyan = require('bunyan');

class Logger {
    constructor (path, name) {
        const env = process.env.NODE_ENV;
        const logLevel = process.env.LOG_LEVEL;
        const stream = {
            level: logLevel ? logLevel : (env === 'test') ? 'fatal' : (env === 'development') ? 'debug' : 'info'
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

    fatal (...args) {
        this.logger.fatal(...args);
    }

    error (...args) {
        this.logger.error(...args);
    }

    warn (...args) {
        this.logger.warn(...args);
    }

    info (...args) {
        this.logger.info(...args);
    }

    debug (...args) {
        this.logger.debug(...args);
    }

    trace (...args) {
        this.logger.trace(...args);
    }

    reopenFileStreams () {
        this.logger.reopenFileStreams();
    }
}

module.exports = Logger;
