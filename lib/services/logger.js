'use strict';

const bunyan = require('bunyan');

class Logger {
    constructor (path, name) {
        const env = process.env.NODE_ENV;
        const logLevel = process.env.LOG_LEVEL;
        const stream = {
            level: logLevel || ((env === 'test') ? 'fatal' : (env === 'development') ? 'debug' : 'info')
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

    // Ensures that the writable stream is flushed.
    // Use this function before exiting the process to not lose log entries
    //
    // See: https://github.com/trentm/node-bunyan/issues/37
    // See: https://github.com/trentm/node-bunyan/issues/73
    end (callback) {
        // process.stdout cannot be closed
        if (!this.path) {
            return callback();
        }

        this.logger.streams[0].stream.on('finish', callback);
        this.logger.streams[0].stream.end(); // close stream, flush buffer to disk
    }
}

module.exports = Logger;
