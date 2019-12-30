'use strict';

const Logger = require('../services/logger');

class BatchLogger extends Logger {
    log (job) {
        return job.log(this.logger);
    }
}

module.exports = BatchLogger;
