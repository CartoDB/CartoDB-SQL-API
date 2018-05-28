'use strict';

const BunyanLogger = require('../app/services/bunyan_logger');

class BatchLogger extends BunyanLogger {
    constructor (path, name) {
        super(path, name);
    }

    log (job) {
        return job.log(this.logger);
    }

    reopenFileStreams () {
        this.logger.reopenFileStreams();
    }
}

module.exports = BatchLogger;
