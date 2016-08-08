'use strict';

var JOB_STATUS_ENUM = {
    PENDING: 'pending',
    RUNNING: 'running',
    DONE: 'done',
    CANCELLED: 'cancelled',
    FAILED: 'failed',
    SKIPPED: 'skipped',
    UNKNOWN: 'unknown'
};

module.exports = JOB_STATUS_ENUM;
