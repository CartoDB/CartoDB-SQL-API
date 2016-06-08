'use strict';

var util = require('util');
var QueryBase = require('./query_base');
var jobStatus = require('../../job_status');

function Fallback(index) {
    QueryBase.call(this, index);
}
util.inherits(Fallback, QueryBase);

module.exports = Fallback;

Fallback.is = function (query) {
    if (query.onsuccess || query.onerror) {
        return true;
    }
    return false;
};

Fallback.prototype.getNextQuery = function (job) {
    if (this.hasOnSuccess(job)) {
        return this.getOnSuccess(job);
    }
    if (this.hasOnError(job)) {
        return this.getOnError(job);
    }
};

Fallback.prototype.getOnSuccess = function (job) {
    if (job.query.query[this.index].status === jobStatus.DONE &&
        job.query.query[this.index].fallback_status === jobStatus.PENDING) {
        return job.query.query[this.index].onsuccess;
    }
};

Fallback.prototype.hasOnSuccess = function (job) {
    return !!this.getOnSuccess(job);
};

Fallback.prototype.getOnError = function (job) {
    if (job.query.query[this.index].status === jobStatus.FAILED &&
        job.query.query[this.index].fallback_status === jobStatus.PENDING) {
        return job.query.query[this.index].onerror;
    }
};

Fallback.prototype.hasOnError = function (job) {
    return !!this.getOnError(job);
};

Fallback.prototype.setStatus = function (status, job, errorMessage) {
    var isValid = false;

    isValid = this.isValidTransition(job.query.query[this.index].fallback_status, status);

    if (isValid) {
        job.query.query[this.index].fallback_status = status;
        if (status === jobStatus.FAILED && errorMessage) {
            job.query.query[this.index].failed_reason = errorMessage;
        }
    }

    return isValid;
};

Fallback.prototype.getStatus = function (job) {
    return job.query.query[this.index].fallback_status;
};
