'use strict';

const BunyanLogger = require('../app/services/bunyanLogger');

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
