'use strict';

var util = require('util');
var JobBase = require('./job_base');
var jobStatus = require('../job_status');

function JobFallback(data) {
    JobBase.call(this, data);

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

// jshint maxcomplexity: 10
JobFallback.prototype.init = function () {
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

// jshint maxcomplexity: 11
JobFallback.prototype.getNextQuery = function () {
    for (var i = 0; i < this.data.query.query.length; i++) {
        if (Array.isArray(this.data.query.query[i].status)) {
            if (this._isNextQuery(i)) {
                return this.data.query.query[i].query;
            } else if (this._isNextQueryOnSuccess(i)) {
                return this.data.query.query[i].onsuccess;
            } else if (this._isNextQueryOnError(i)) {
                return this.data.query.query[i].onerror;
            } else if (this.data.query.query[i].status[0] === jobStatus.FAILED) {
                return;
            }
        } else if (this.data.query.query[i].status === jobStatus.PENDING) {
            return this.data.query.query[i].query;
        }
    }

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


JobFallback.prototype.setStatus = function (finalStatus) {
    var now = new Date().toISOString();
    var resultFromQuery = this._setQueryStatus(finalStatus);
    var resultFromJob = this._setJobStatus(finalStatus, resultFromQuery.isChangeAppliedToFallback);

    if (!resultFromJob.isValid && !resultFromQuery.isValid) {
        var initialStatus = Array.isArray(this.data.status) ? this.data.status[0] : this.data.status;
        throw new Error('Cannot set status from ' + initialStatus+ ' to ' + finalStatus);
    }

    this.data.updated_at = now;
};

JobFallback.prototype._setJobStatus = function (finalStatus, isChangeAppliedToFallback) {
    var isValid = false;

    if (finalStatus === jobStatus.DONE && this.hasNextQuery()) {
        finalStatus = jobStatus.PENDING;
    } else if (finalStatus === jobStatus.FAILED && this.hasNextQuery()) {
        finalStatus = jobStatus.PENDING;
    } else if (isChangeAppliedToFallback && finalStatus === jobStatus.FAILED && !this.hasNextQuery()) {
        finalStatus = jobStatus.DONE;
    } else if (isChangeAppliedToFallback && finalStatus === jobStatus.CANCELLED && !this.hasNextQuery()) {
        finalStatus = jobStatus.DONE;
    }

    if (!Array.isArray(this.data.status)) {
        isValid = this.isValidStatusTransition(this.data.status, finalStatus);
        if (isValid) {
            this.data.status = finalStatus;
        }
    } else {
        for (var i = 0; i < this.data.status.length; i++) {
            isValid = this.isValidStatusTransition(this.data.status[i], finalStatus);
            if (isValid) {
                this.data.status[i] = finalStatus;
                break;
            }
        }
    }

    return {
        isValid: isValid
    };
};

JobFallback.prototype._setQueryStatus = function (finalStatus) {
    var isValid = false;
    var isChangeAppliedToFallback = false;

    for (var i = 0; i < this.data.query.query.length; i++) {
        if (Array.isArray(this.data.query.query[i].status)) {
            for (var j = 0; j < this.data.query.query[i].status.length; j++) {
                isValid = this.isValidStatusTransition(this.data.query.query[i].status[j], finalStatus);

                if (isValid) {
                    this.data.query.query[i].status[j] = finalStatus;
                    isChangeAppliedToFallback = (j > 0);
                    break;
                }
            }
        } else {
            isValid = this.isValidStatusTransition(this.data.query.query[i].status, finalStatus);

            if (isValid) {
                this.data.query.query[i].status = finalStatus;
            }
        }

        if (isValid) {
            break;
        }
    }

    return {
        isValid: isValid,
        isChangeAppliedToFallback: isChangeAppliedToFallback
    };
};
