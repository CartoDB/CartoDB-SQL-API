'use strict';

var util = require('util');
var JobBase = require('./job_base');
var jobStatus = require('./job_status');

function JobMultiple(data) {
    JobBase.call(this, data);

    this.init();
}
util.inherits(JobMultiple, JobBase);

module.exports = JobMultiple;

JobMultiple.prototype.is = function (query) {
    if (!Array.isArray(query)) {
        return false;
    }

    for (var i = 0; i < query.length; i++) {
        if (typeof query[i] !== 'string') {
            return false;
        }
    }

    return true;
};

JobMultiple.prototype.init = function () {
    for (var i = 0; i < this.data.query.length; i++) {
        this.data.query[i] = {
            query: this.data.query[i],
            status: jobStatus.PENDING
        };
    }
};

JobMultiple.prototype.isPending = function (index) {
    var isPending = JobMultiple.super_.prototype.isPending.call(this);

    if (isPending && index) {
        isPending = this.data.query[index].status === jobStatus.PENDING;
    }

    return isPending;
};

JobMultiple.prototype.hasNextQuery = function () {
    return !!this.getNextQuery();
};

JobMultiple.prototype.getNextQuery = function () {
    if (this.isPending()) {
        for (var i = 0; i < this.data.query.length; i++) {
            if (this.isPending(i)) {
                return this.data.query[i].query;
            }
        }
    }
};

JobMultiple.prototype.setQuery = function (query) {
    var isMultiple = this.is(query);

    if (this.isPending() && isMultiple) {
        this.data.query = query;
    }
};

JobMultiple.prototype.setStatus = function (finalStatus) {
    var initialStatus = this.data.status;

    // if transition is to "done" and there are more queries to run
    // then job status must be "pending" instead of "done"
    // else job status transition to done (if "running")
    if (finalStatus === jobStatus.DONE && this.hasNextQuery()) {
        JobMultiple.super_.prototype.setStatus.call(this, jobStatus.PENDING);
    } else {
        JobMultiple.super_.prototype.setStatus.call(this, finalStatus);
    }

    for (var i = 0; i < this.data.query.length; i++) {
        var isValid = JobMultiple.super_.isValidStatusTransition(this.data.query[i].status, finalStatus);

        if (isValid) {
            this.data.query[i].status = finalStatus;
            return;
        }
    }

    throw new Error('Cannot set status from ' + initialStatus + ' to ' + finalStatus);
};

JobMultiple.prototype.set = function (data) {
    JobMultiple.super_.prototype.set.call(this, data);

    if (data.status) {
        this.setStatus(data.status);
    }

    if (data.query) {
        this.setQuery(data.query);
    }
};
