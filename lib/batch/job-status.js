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

var finalStatus = [
    JOB_STATUS_ENUM.CANCELLED,
    JOB_STATUS_ENUM.DONE,
    JOB_STATUS_ENUM.FAILED,
    JOB_STATUS_ENUM.UNKNOWN
];
module.exports.isFinal = function (status) {
    return finalStatus.indexOf(status) !== -1;
};
