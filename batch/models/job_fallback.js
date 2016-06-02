'use strict';

var util = require('util');
var JobBase = require('./job_base');
var jobStatus = require('../job_status');
var QueryFallback = require('./query/query_fallback');
var MainFallback = require('./query/main_fallback');
var QueryFactory = require('./query/query_factory');

function JobFallback(jobDefinition) {
    JobBase.call(this, jobDefinition);

    this.init();

    this.queries = [];
    for (var i = 0; i < this.data.query.query.length; i++) {
        this.queries[i] = QueryFactory.create(this.data, i);
    }

    if (MainFallback.is(this.data)) {
        this.fallback = new MainFallback();
    }
}
util.inherits(JobFallback, JobBase);

module.exports = JobFallback;

// from user: {
//     query: {
//         query: [{
//             query: 'select ...',
//             onsuccess: 'select ..'
//         }],
//         onerror: 'select ...'
//     }
// }
// from redis: {
//     status: 'pending',
//     fallback_status: 'pending'
//     query: {
//         query: [{
//             query: 'select ...',
//             onsuccess: 'select ..'
//             status: 'pending',
//             fallback_status: 'pending',
//         }],
//         onerror: 'select ...'
//     }
// }

JobFallback.is = function (query) {
    if (!query.query) {
        return false;
    }

    if (!Array.isArray(query.query)) {
        return false;
    }

    for (var i = 0; i < query.query.length; i++) {
        if (!QueryFallback.is(query.query[i])) {
            return false;
        }
    }

    return true;
};

JobFallback.prototype.init = function () {
    // jshint maxcomplexity: 9
    for (var i = 0; i < this.data.query.query.length; i++) {
        if ((this.data.query.query[i].onsuccess || this.data.query.query[i].onerror) &&
            !this.data.query.query[i].status) {
            this.data.query.query[i].status = jobStatus.PENDING;
            this.data.query.query[i].fallback_status = jobStatus.PENDING;
        } else if (!this.data.query.query[i].status){
            this.data.query.query[i].status = jobStatus.PENDING;
        }
    }

    if (!this.data.status) {
        this.data.status = jobStatus.PENDING;
        if (this.data.query.onsuccess || this.data.query.onerror) {
            this.data.status = jobStatus.PENDING;
            this.data.fallback_status = jobStatus.PENDING;
        }
    } else if (!this.data.status) {
        this.data.status = jobStatus.PENDING;
    }
};

JobFallback.prototype.getNextQueryFromQueries = function () {
    for (var i = 0; i < this.queries.length; i++) {
        if (this.queries[i].hasNextQuery(this.data)) {
            return this.queries[i].getNextQuery(this.data);
        }
    }
};

JobFallback.prototype.getNextQueryFromFallback = function () {
    if (this.fallback && this.fallback.hasNextQuery(this.data)) {

        return this.fallback.getNextQuery(this.data);
    }
};

JobFallback.prototype.getNextQuery = function () {
    var query = this.getNextQueryFromQueries();

    if (!query) {
        query = this.getNextQueryFromFallback();
    }

    return query;
};

JobFallback.prototype.setQuery = function (query) {
    if (!JobFallback.is(query)) {
        throw new Error('You must indicate a valid SQL');
    }

    JobFallback.super_.prototype.setQuery.call(this, query);
};

JobFallback.prototype.setStatus = function (status, errorMesssage) {
    // jshint maxcomplexity: 7

    var now = new Date().toISOString();
    var hasChanged = {
        isValid: false,
        appliedToFallback: false
    };
    var result = {};

    for (var i = 0; i < this.queries.length; i++) {
        result = this.queries[i].setStatus(status, this.data, hasChanged, errorMesssage);

        if (result.isValid) {
            hasChanged = result;
        }
    }

    result = this.setJobStatus(status, this.data, hasChanged, errorMesssage);

    if (result.isValid) {
        hasChanged = result;
    }

    if (!this.getNextQueryFromQueries() && this.fallback) {
        result = this.fallback.setStatus(status, this.data, hasChanged);

        if (result.isValid) {
            hasChanged = result;
        }
    }

    if (!hasChanged.isValid) {
        throw new Error('Cannot set status to ' + status);
    }

    this.data.updated_at = now;
};

JobFallback.prototype.setJobStatus = function (status, job, hasChanged, errorMesssage) {
    var isValid = false;

    status = this.shiftStatus(status, hasChanged);

    isValid = this.isValidTransition(job.status, status);

    if (isValid) {
        job.status = status;
    }

    if (status === jobStatus.FAILED && errorMesssage && !hasChanged.appliedToFallback) {
        job.failed_reason = errorMesssage;
    }

    return { isValid: isValid, appliedToFallback: false };
};

JobFallback.prototype.shiftStatus = function (status, hasChanged) {
    // jshint maxcomplexity: 7
    if (hasChanged.appliedToFallback) {
        if (!this.getNextQueryFromQueries() && (status === jobStatus.DONE || status === jobStatus.FAILED)) {
            status = this._getLastStatusFromFinishedQuery();
        } else if (status === jobStatus.DONE || status === jobStatus.FAILED){
            status = jobStatus.PENDING;
        }
    } else if (this.getNextQueryFromQueries() && status !== jobStatus.RUNNING) {
        status = jobStatus.PENDING;
    }

    return status;
};


JobFallback.prototype._getLastStatusFromFinishedQuery = function () {
    var lastStatus =  jobStatus.DONE;

    for (var i = 0; i < this.data.query.query.length; i++) {
        if (this.data.query.query[i].fallback_status) {
            if (this.isFinalStatus(this.data.query.query[i].status)) {
                lastStatus = this.data.query.query[i].status;
            } else {
                break;
            }
        } else {
            if (this.isFinalStatus(this.data.query.query[i].status)) {
                lastStatus = this.data.query.query[i].status;
            } else {
                break;
            }
        }
    }

    return lastStatus;
};
