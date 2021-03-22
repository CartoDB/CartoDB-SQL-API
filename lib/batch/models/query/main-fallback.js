'use strict';

var util = require('util');
var QueryBase = require('./query-base');
var jobStatus = require('../../job-status');

function MainFallback () {
    QueryBase.call(this);
}
util.inherits(MainFallback, QueryBase);

module.exports = MainFallback;

MainFallback.is = function (job) {
    if (job.query.onsuccess || job.query.onerror) {
        return true;
    }
    return false;
};

MainFallback.prototype.getNextQuery = function (job) {
    if (this.hasOnSuccess(job)) {
        return this.getOnSuccess(job);
    }

    if (this.hasOnError(job)) {
        return this.getOnError(job);
    }
};

MainFallback.prototype.getOnSuccess = function (job) {
    if (job.status === jobStatus.DONE && job.fallback_status === jobStatus.PENDING) {
        var onsuccessQuery = job.query.onsuccess;
        if (onsuccessQuery) {
            onsuccessQuery = onsuccessQuery.replace(/<%=\s*job_id\s*%>/g, job.job_id);
        }
        return onsuccessQuery;
    }
};

MainFallback.prototype.hasOnSuccess = function (job) {
    return !!this.getOnSuccess(job);
};

MainFallback.prototype.getOnError = function (job) {
    if (job.status === jobStatus.FAILED && job.fallback_status === jobStatus.PENDING) {
        var onerrorQuery = job.query.onerror;
        if (onerrorQuery) {
            onerrorQuery = onerrorQuery.replace(/<%=\s*job_id\s*%>/g, job.job_id);
            onerrorQuery = onerrorQuery.replace(/<%=\s*error_message\s*%>/g, job.failed_reason);
        }
        return onerrorQuery;
    }
};

MainFallback.prototype.hasOnError = function (job) {
    return !!this.getOnError(job);
};

MainFallback.prototype.setStatus = function (status, job, previous) {
    var isValid = false;
    var appliedToFallback = false;

    if (previous.isValid && !previous.appliedToFallback) {
        if (this.isFinalStatus(status) && !this.hasNextQuery(job)) {
            isValid = this.isValidTransition(job.fallback_status, jobStatus.SKIPPED);

            if (isValid) {
                job.fallback_status = jobStatus.SKIPPED;
                appliedToFallback = true;
            }
        }
    } else if (!previous.isValid) {
        isValid = this.isValidTransition(job.fallback_status, status);

        if (isValid) {
            job.fallback_status = status;
            appliedToFallback = true;
        }
    }

    return { isValid: isValid, appliedToFallback: appliedToFallback };
};
