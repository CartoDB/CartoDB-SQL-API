'use strict';

var assert = require('assert');
var JobStatus = require('../job-status');
var validStatusTransitions = [
    [JobStatus.PENDING, JobStatus.RUNNING],
    [JobStatus.PENDING, JobStatus.CANCELLED],
    [JobStatus.PENDING, JobStatus.UNKNOWN],
    [JobStatus.PENDING, JobStatus.SKIPPED],
    [JobStatus.RUNNING, JobStatus.DONE],
    [JobStatus.RUNNING, JobStatus.FAILED],
    [JobStatus.RUNNING, JobStatus.CANCELLED],
    [JobStatus.RUNNING, JobStatus.PENDING],
    [JobStatus.RUNNING, JobStatus.UNKNOWN]
];

function JobStateMachine () {
}

module.exports = JobStateMachine;

JobStateMachine.prototype.isValidTransition = function (initialStatus, finalStatus) {
    var transition = [initialStatus, finalStatus];

    for (var i = 0; i < validStatusTransitions.length; i++) {
        try {
            assert.deepStrictEqual(transition, validStatusTransitions[i]);
            return true;
        } catch (e) {
            continue;
        }
    }

    return false;
};

JobStateMachine.prototype.isFinalStatus = function (status) {
    return JobStatus.isFinal(status);
};
