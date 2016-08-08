'use strict';

var assert = require('assert');
var jobStatus = require('../job_status');
var finalStatus = [
    jobStatus.CANCELLED,
    jobStatus.DONE,
    jobStatus.FAILED,
    jobStatus.UNKNOWN
];

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

function JobStateMachine () {
}

module.exports = JobStateMachine;

JobStateMachine.prototype.isValidTransition = function (initialStatus, finalStatus) {
    var transition = [ initialStatus, finalStatus ];

    for (var i = 0; i < validStatusTransitions.length; i++) {
        try {
            assert.deepEqual(transition, validStatusTransitions[i]);
            return true;
        } catch (e) {
            continue;
        }
    }

    return false;
};

JobStateMachine.prototype.isFinalStatus = function (status) {
    return finalStatus.indexOf(status) !== -1;
};
