'use strict';

var jobStatus = require('../job_status');

var validStatusTransitions = [
    [jobStatus.PENDING, jobStatus.RUNNING],
    [jobStatus.PENDING, jobStatus.CANCELLED],
    [jobStatus.PENDING, jobStatus.UNKNOWN],
    [jobStatus.PENDING, jobStatus.SKIPPED],
    [jobStatus.RUNNING, jobStatus.DONE],
    [jobStatus.RUNNING, jobStatus.FAILED],
    [jobStatus.RUNNING, jobStatus.CANCELLED],
    [jobStatus.RUNNING, jobStatus.PENDING],
    [jobStatus.RUNNING, jobStatus.UNKNOWN]
];

module.exports = validStatusTransitions;
