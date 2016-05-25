'use strict';

var util = require('util');
var JobBase = require('./job_base');
var jobStatus = require('../job_status');

function JobMultiple(jobDefinition) {
    JobBase.call(this, jobDefinition);

    this.init();
}
util.inherits(JobMultiple, JobBase);

module.exports = JobMultiple;

JobMultiple.is = function (query) {
    if (!Array.isArray(query)) {
        return false;
    }

    // 1. From user: ['select * from ...', 'select * from ...']
    // 2. From redis: [ { query: 'select * from ...', status: 'pending' },
    //   { query: 'select * from ...', status: 'pending' } ]
    for (var i = 0; i < query.length; i++) {
        if (typeof query[i] !== 'string') {
            if (typeof query[i].query !== 'string') {
                return false;
            }
        }
    }

    return true;
};

JobMultiple.prototype.init = function () {

    if (!this.data.status) {
        this.data.status = jobStatus.PENDING;
    }

    for (var i = 0; i < this.data.query.length; i++) {
        if (!this.data.query[i].query && !this.data.query[i].status) {
            this.data.query[i] = {
                query: this.data.query[i],
                status: jobStatus.PENDING
            };
        }
    }
};

JobMultiple.prototype.getNextQuery = function () {
    for (var i = 0; i < this.data.query.length; i++) {
        if (this.data.query[i].status === jobStatus.PENDING) {
            return this.data.query[i].query;
        }
    }
};

JobMultiple.prototype.setQuery = function (query) {
    if (!JobMultiple.is(query)) {
        throw new Error('You must indicate a valid SQL');
    }

    JobMultiple.super_.prototype.setQuery.call(this, query);
};

JobMultiple.prototype.setStatus = function (finalStatus, errorMesssage) {
    var initialStatus = this.data.status;
    // if transition is to "done" and there are more queries to run
    // then job status must be "pending" instead of "done"
    // else job status transition to done (if "running")
    if (finalStatus === jobStatus.DONE && this.hasNextQuery()) {
        JobMultiple.super_.prototype.setStatus.call(this, jobStatus.PENDING);
    } else {
        JobMultiple.super_.prototype.setStatus.call(this, finalStatus, errorMesssage);
    }

    for (var i = 0; i < this.data.query.length; i++) {
        var isValid = JobMultiple.super_.prototype.isValidStatusTransition(this.data.query[i].status, finalStatus);

        if (isValid) {
            this.data.query[i].status = finalStatus;
            if (finalStatus === jobStatus.FAILED && errorMesssage) {
                this.data.query[i].failed_reason = errorMesssage;
            }
            return;
        }
    }

    throw new Error('Cannot set status from ' + initialStatus + ' to ' + finalStatus);
};
