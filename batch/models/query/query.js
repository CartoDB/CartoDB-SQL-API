'use strict';

var util = require('util');
var QueryBase = require('./query_base');
var jobStatus = require('../../job_status');

function Query(index) {
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
        return job.query.query[this.index].query;
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
