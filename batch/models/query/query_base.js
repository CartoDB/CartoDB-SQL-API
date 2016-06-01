'use strict';

var jobStatus = require('../../job_status');
var assert = require('assert');
var validStatusTransitions = require('../job_status_transitions');
var finalStatus = [
    jobStatus.CANCELLED,
    jobStatus.DONE,
    jobStatus.FAILED,
    jobStatus.UNKNOWN
];

function QueryBase(index) {
    this.index = index;
}

module.exports = QueryBase;

QueryBase.prototype.isFinalStatus = function (status) {
    return finalStatus.indexOf(status) !== -1;
};

// should be implemented
QueryBase.prototype.setStatus = function () {
    throw new Error('Unimplemented method');
};

// should be implemented
QueryBase.prototype.getNextQuery = function () {
    throw new Error('Unimplemented method');
};

QueryBase.prototype.hasNextQuery = function (job) {
    return !!this.getNextQuery(job);
};


QueryBase.prototype.isValidTransition = function (initialStatus, finalStatus) {
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
