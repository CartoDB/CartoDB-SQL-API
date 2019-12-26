'use strict';

var util = require('util');
var QueryBase = require('./query-base');
var Query = require('./query');
var Fallback = require('./fallback');
var jobStatus = require('../../job-status');

function QueryFallback (job, index) {
    QueryBase.call(this, index);

    this.init(job, index);
}

util.inherits(QueryFallback, QueryBase);

QueryFallback.is = function (query) {
    if (Query.is(query)) {
        return true;
    }
    return false;
};

QueryFallback.prototype.init = function (job, index) {
    this.query = new Query(index);

    if (Fallback.is(job.query.query[index])) {
        this.fallback = new Fallback(index);
    }
};

QueryFallback.prototype.getNextQuery = function (job) {
    if (this.query.hasNextQuery(job)) {
        return this.query.getNextQuery(job);
    }

    if (this.fallback && this.fallback.hasNextQuery(job)) {
        return this.fallback.getNextQuery(job);
    }
};

QueryFallback.prototype.setStatus = function (status, job, previous, errorMesssage) {
    var isValid = false;
    var appliedToFallback = false;

    if (previous.isValid && !previous.appliedToFallback) {
        if (status === jobStatus.FAILED || status === jobStatus.CANCELLED) {
            this.query.setStatus(jobStatus.SKIPPED, job, errorMesssage);

            if (this.fallback) {
                this.fallback.setStatus(jobStatus.SKIPPED, job);
            }
        }
    } else if (!previous.isValid) {
        isValid = this.query.setStatus(status, job, errorMesssage);

        if (this.fallback) {
            if (!isValid) {
                isValid = this.fallback.setStatus(status, job, errorMesssage);
                appliedToFallback = true;
            } else if (isValid && this.isFinalStatus(status) && !this.fallback.hasNextQuery(job)) {
                this.fallback.setStatus(jobStatus.SKIPPED, job);
            }
        }
    }

    return { isValid: isValid, appliedToFallback: appliedToFallback };
};

QueryFallback.prototype.getStatus = function (job) {
    return this.query.getStatus(job);
};

module.exports = QueryFallback;
