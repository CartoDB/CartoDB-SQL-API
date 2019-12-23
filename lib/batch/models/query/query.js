'use strict';

var util = require('util');
var QueryBase = require('./query-base');
var jobStatus = require('../../job-status');

function Query (index) {
    QueryBase.call(this, index);
}
util.inherits(Query, QueryBase);

module.exports = Query;

Query.is = function (query) {
    if (query.query && typeof query.query === 'string') {
        return true;
    }

    return false;
};

Query.prototype.getNextQuery = function (job) {
    if (job.query.query[this.index].status === jobStatus.PENDING) {
        var query = {
            query: job.query.query[this.index].query
        };
        if (Number.isFinite(job.query.query[this.index].timeout)) {
            query.timeout = job.query.query[this.index].timeout;
        }
        return query;
    }
};

Query.prototype.setStatus = function (status, job, errorMesssage) {
    var isValid = false;

    isValid = this.isValidTransition(job.query.query[this.index].status, status);

    if (isValid) {
        job.query.query[this.index].status = status;
        if (status === jobStatus.RUNNING) {
            job.query.query[this.index].started_at = new Date().toISOString();
        }
        if (this.isFinalStatus(status)) {
            job.query.query[this.index].ended_at = new Date().toISOString();
        }
        if (status === jobStatus.FAILED && errorMesssage) {
            job.query.query[this.index].failed_reason = errorMesssage;
        }
    }

    return isValid;
};

Query.prototype.getStatus = function (job) {
    return job.query.query[this.index].status;
};
