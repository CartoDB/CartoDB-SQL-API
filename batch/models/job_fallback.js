'use strict';

var util = require('util');
var JobBase = require('./job_base');
var jobStatus = require('../job_status');
var breakStatus = [
    jobStatus.CANCELLED,
    jobStatus.FAILED,
    jobStatus.UNKNOWN
];
function isBreakStatus(status) {
    return breakStatus.indexOf(status) !== -1;
}
var finalStatus = [
    jobStatus.CANCELLED,
    jobStatus.DONE,
    jobStatus.FAILED,
    jobStatus.UNKNOWN
];
function isFinalStatus(status) {
    return finalStatus.indexOf(status) !== -1;
}

function JobFallback(jobDefinition) {
    JobBase.call(this, jobDefinition);

    this.init();
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
//     status: [pending, pending]
//     query: {
//         query: [{
//             query: 'select ...',
//             onsuccess: 'select ..'
//             status: ['pending', 'pending']
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
        if (!query.query[i].query) {
            return false;
        }

        if (typeof query.query[i].query !== 'string') {
            return false;
        }
    }

    return true;
};

JobFallback.prototype.init = function () {
    // jshint maxcomplexity: 10
    for (var i = 0; i < this.data.query.query.length; i++) {
        if ((this.data.query.query[i].onsuccess || this.data.query.query[i].onerror) &&
            !this.data.query.query[i].status) {
            this.data.query.query[i].status = [ jobStatus.PENDING, jobStatus.PENDING ];
        } else if (!this.data.query.query[i].status){
            this.data.query.query[i].status = jobStatus.PENDING;
        }
    }

    if ((this.data.query.onsuccess || this.data.query.onerror) && !this.data.status) {
        this.data.status = [ jobStatus.PENDING, jobStatus.PENDING ];
    } else if (!this.data.status) {
        this.data.status = jobStatus.PENDING;
    }
};

JobFallback.prototype.getNextQuery = function () {
    var query = this._getNextQueryFromQuery();

    if (!query) {
        query = this._getNextQueryFromJobFallback();
    }

    return query;
};

JobFallback.prototype._hasNextQueryFromQuery = function () {
    return !!this._getNextQueryFromQuery();
};

JobFallback.prototype._getNextQueryFromQuery = function () {
    // jshint maxcomplexity: 10
    for (var i = 0; i < this.data.query.query.length; i++) {
        if (Array.isArray(this.data.query.query[i].status)) {
            if (this._isNextQuery(i)) {
                return this.data.query.query[i].query;
            } else if (this._isNextQueryOnSuccess(i)) {
                return this.data.query.query[i].onsuccess;
            } else if (this._isNextQueryOnError(i)) {
                return this.data.query.query[i].onerror;
            } else if (isBreakStatus(this.data.query.query[i].status[0])) {
                return;
            }
        } else if (this.data.query.query[i].status === jobStatus.PENDING) {
            return this.data.query.query[i].query;
        }
    }
};

JobFallback.prototype._getNextQueryFromJobFallback = function () {
    if (Array.isArray(this.data.status)) {
        if (this._isNextQueryOnSuccessJob()) {
            return this.data.query.onsuccess;
        } else if (this._isNextQueryOnErrorJob()) {
            return this.data.query.onerror;
        }
    }
};

JobFallback.prototype._isNextQuery = function (index) {
    return this.data.query.query[index].status[0] === jobStatus.PENDING;
};

JobFallback.prototype._isNextQueryOnSuccess = function (index) {
    return this.data.query.query[index].status[0] === jobStatus.DONE &&
        this.data.query.query[index].onsuccess &&
        this.data.query.query[index].status[1] === jobStatus.PENDING;
};

JobFallback.prototype._isNextQueryOnError = function (index) {
    return this.data.query.query[index].status[0] === jobStatus.FAILED &&
        this.data.query.query[index].onerror &&
        this.data.query.query[index].status[1] === jobStatus.PENDING;
};

JobFallback.prototype._isNextQueryOnSuccessJob = function () {
    return this.data.status[0] === jobStatus.DONE &&
        this.data.query.onsuccess &&
        this.data.status[1] === jobStatus.PENDING;
};

JobFallback.prototype._isNextQueryOnErrorJob = function () {
    return this.data.status[0] === jobStatus.FAILED &&
        this.data.query.onerror &&
        this.data.status[1] === jobStatus.PENDING;
};

JobFallback.prototype.setQuery = function (query) {
    if (!JobFallback.is(query)) {
        throw new Error('You must indicate a valid SQL');
    }

    JobFallback.super_.prototype.setQuery.call(this, query);
};

JobFallback.prototype.setStatus = function (status, errorMesssage) {
    var now = new Date().toISOString();
    var resultFromQuery = this._setQueryStatus(status, errorMesssage);
    var resultFromJob = this._setJobStatus(status, resultFromQuery.isChangeAppliedToQueryFallback, errorMesssage);

    if (!resultFromJob.isValid && !resultFromQuery.isValid) {
        var initialStatus = Array.isArray(this.data.status) ? this.data.status[0] : this.data.status;
        throw new Error('Cannot set status from ' + initialStatus+ ' to ' + status);
    }

    this.data.updated_at = now;
};

JobFallback.prototype._getLastStatusFromFinishedQuery = function () {
    var lastStatus =  jobStatus.DONE;

    for (var i = 0; i < this.data.query.query.length; i++) {
        if (Array.isArray(this.data.query.query[i].status)) {
            if (isFinalStatus(this.data.query.query[i].status[0])) {
                lastStatus = this.data.query.query[i].status[0];
            } else {
                break;
            }
        } else {
            if (isFinalStatus(this.data.query.query[i].status)) {
                lastStatus = this.data.query.query[i].status;
            } else {
                break;
            }
        }
    }

    return lastStatus;
};

JobFallback.prototype._setJobStatus = function (status, isChangeAppliedToQueryFallback, errorMesssage) {
    var isValid = false;

    status = this._shiftJobStatus(status, isChangeAppliedToQueryFallback);

    if (!Array.isArray(this.data.status)) {
        isValid = this.isValidStatusTransition(this.data.status, status);
        if (isValid) {
            this.data.status = status;
        }
    } else {
        for (var i = 0; i < this.data.status.length; i++) {
            isValid = this.isValidStatusTransition(this.data.status[i], status);
            if (isValid) {
                this.data.status[i] = status;
                break;
            }
        }
    }

    if (status === jobStatus.FAILED && errorMesssage && !isChangeAppliedToQueryFallback) {
        this.data.failed_reason = errorMesssage;
    }

    return {
        isValid: isValid
    };
};

JobFallback.prototype._shiftJobStatus = function (status, isChangeAppliedToQueryFallback) {
    // jshint maxcomplexity: 10

    // In some scenarios we have to change the normal flow in order to keep consistency
    // between query's status and job's status.

    if (isChangeAppliedToQueryFallback) {
        if (!this._hasNextQueryFromQuery() && (status === jobStatus.DONE || status === jobStatus.FAILED)) {
            status = this._getLastStatusFromFinishedQuery();
        } else if (status === jobStatus.DONE || status === jobStatus.FAILED){
            status = jobStatus.PENDING;
        }
    } else if (this._hasNextQueryFromQuery() && status !== jobStatus.RUNNING) {
        status = jobStatus.PENDING;
    }

    return status;
};


JobFallback.prototype._setQueryStatus = function (status, errorMesssage) {
    // jshint maxcomplexity: 10
    var isValid = false;
    var isChangeAppliedToQueryFallback = false;

    for (var i = 0; i < this.data.query.query.length; i++) {
        if (Array.isArray(this.data.query.query[i].status)) {
            for (var j = 0; j < this.data.query.query[i].status.length; j++) {
                isValid = this.isValidStatusTransition(this.data.query.query[i].status[j], status);

                if (isValid) {
                    this.data.query.query[i].status[j] = status;
                    if (status === jobStatus.FAILED && errorMesssage) {
                        this.data.query.query[i].failed_reason = errorMesssage;
                    }
                    isChangeAppliedToQueryFallback = (j > 0);
                    break;
                }
            }
        } else {
            isValid = this.isValidStatusTransition(this.data.query.query[i].status, status);

            if (isValid) {
                this.data.query.query[i].status = status;
                if (status === jobStatus.FAILED && errorMesssage) {
                    this.data.query.query[i].failed_reason = errorMesssage;
                }
            }
        }

        if (isValid) {
            break;
        }
    }

    return {
        isValid: isValid,
        isChangeAppliedToQueryFallback: isChangeAppliedToQueryFallback
    };
};
