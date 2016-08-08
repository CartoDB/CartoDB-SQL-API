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

// 1. from user: {
//     query: {
//         query: [{
//             query: 'select ...',
//             onsuccess: 'select ..'
//         }],
//         onerror: 'select ...'
//     }
// }
//
// 2. from redis: {
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
    for (var i = 0; i < this.data.query.query.length; i++) {
        if (shouldInitStatus(this.data.query.query[i])){
            this.data.query.query[i].status = jobStatus.PENDING;
        }
        if (shouldInitQueryFallbackStatus(this.data.query.query[i])) {
            this.data.query.query[i].fallback_status = jobStatus.PENDING;
        }
    }

    if (shouldInitStatus(this.data)) {
        this.data.status = jobStatus.PENDING;
    }

    if (shouldInitFallbackStatus(this.data)) {
        this.data.fallback_status = jobStatus.PENDING;
    }
};

function shouldInitStatus(jobOrQuery) {
    return !jobOrQuery.status;
}

function shouldInitQueryFallbackStatus(query) {
    return (query.onsuccess || query.onerror) && !query.fallback_status;
}

function shouldInitFallbackStatus(job) {
    return (job.query.onsuccess || job.query.onerror) && !job.fallback_status;
}

JobFallback.prototype.getNextQueryFromQueries = function () {
    for (var i = 0; i < this.queries.length; i++) {
        if (this.queries[i].hasNextQuery(this.data)) {
            return this.queries[i].getNextQuery(this.data);
        }
    }
};

JobFallback.prototype.hasNextQueryFromQueries = function () {
    return !!this.getNextQueryFromQueries();
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
    var now = new Date().toISOString();

    var hasChanged = this.setQueryStatus(status, this.data, errorMesssage);
    hasChanged = this.setJobStatus(status, this.data, hasChanged, errorMesssage);
    hasChanged = this.setFallbackStatus(status, this.data, hasChanged);

    if (!hasChanged.isValid) {
        throw new Error('Cannot set status to ' + status);
    }

    this.data.updated_at = now;
};

JobFallback.prototype.setQueryStatus = function (status, job, errorMesssage) {
    return this.queries.reduce(function (hasChanged, query) {
        var result = query.setStatus(status, this.data, hasChanged, errorMesssage);
        return result.isValid ? result : hasChanged;
    }.bind(this), { isValid: false, appliedToFallback: false });
};

JobFallback.prototype.setJobStatus = function (status, job, hasChanged, errorMesssage) {
    var result = {
        isValid: false,
        appliedToFallback: false
    };

    status = this.shiftStatus(status, hasChanged);

    result.isValid = this.isValidTransition(job.status, status);
    if (result.isValid) {
        job.status = status;
        if (status === jobStatus.FAILED && errorMesssage && !hasChanged.appliedToFallback) {
            job.failed_reason = errorMesssage;
        }
    }

    return result.isValid ? result : hasChanged;
};

JobFallback.prototype.setFallbackStatus = function (status, job, hasChanged) {
    var result = hasChanged;

    if (this.fallback && !this.hasNextQueryFromQueries()) {
        result = this.fallback.setStatus(status, job, hasChanged);
    }

    return result.isValid ? result : hasChanged;
};

JobFallback.prototype.shiftStatus = function (status, hasChanged) {
    // jshint maxcomplexity: 7
    if (hasChanged.appliedToFallback) {
        if (!this.hasNextQueryFromQueries() && (status === jobStatus.DONE || status === jobStatus.FAILED)) {
            status = this.getLastFinishedStatus();
        } else if (status === jobStatus.DONE || status === jobStatus.FAILED){
            status = jobStatus.PENDING;
        }
    } else if (this.hasNextQueryFromQueries() && status !== jobStatus.RUNNING) {
        status = jobStatus.PENDING;
    }

    return status;
};

JobFallback.prototype.getLastFinishedStatus = function () {
    return this.queries.reduce(function (lastFinished, query) {
        var status = query.getStatus(this.data);
        return this.isFinalStatus(status) ? status : lastFinished;
    }.bind(this), jobStatus.DONE);
};
