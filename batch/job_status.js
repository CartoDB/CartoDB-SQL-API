'use strict';

var JOB_STATUS_ENUM = {
    PENDING: 'pending',
    RUNNING: 'running',
    DONE: 'done',
    CANCELLED: 'cancelled',
    FAILED: 'failed',
    UNKNOWN: 'unknown'
};

module.exports = JOB_STATUS_ENUM;
module.exports.keys = function keys() {
    return Object.keys(JOB_STATUS_ENUM);
};
module.exports.values = function values() {
    return Object.values(JOB_STATUS_ENUM);
};
