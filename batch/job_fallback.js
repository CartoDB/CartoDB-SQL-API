'use strict';

var util = require('util');
var JobBase = require('./job_base');
var jobStatus = require('./job_status');

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

// from redis: {
//     query: {
//         query: [{
//             query: 'select ...',
//             onsuccess: 'select ..'
//             status: ['pending', 'pending']
//         }],
//         onerror: 'select ...'
//     }
// }

// jshint maxcomplexity: 11
JobFallback.prototype.getNextQuery = function () {

    for (var i = 0; i < this.data.query.query.length; i++) {
        if (Array.isArray(this.data.query.query[i].status)) {
            if (this.data.query.query[i].status[0] === jobStatus.PENDING) {
                return this.data.query.query[i].query;
            } else if (this.data.query.query[i].status[0] === jobStatus.DONE &&
                this.data.query.query[i].onsuccess && this.data.query.query[i].status[1] === jobStatus.PENDING) {
                return this.data.query.query[i].onsuccess;
            } else if (this.data.query.query[i].status[0] === jobStatus.FAILED &&
                this.data.query.query[i].onerror && this.data.query.query[i].status[1] === jobStatus.PENDING) {
                return this.data.query.query[i].onerror;
            }
        } else if (this.data.query.query[i].status === jobStatus.PENDING) {
            return this.data.query.query[i].query;
        }
    }

    if (Array.isArray(this.data.status)) {
        if (this.data.status[0] === jobStatus.DONE && this.data.query.onsuccess &&
            this.data.status[1] === jobStatus.PENDING) {
            return this.data.query.onsuccess;
        } else if (this.data.status[0] === jobStatus.FAILED &&  this.data.query.onerror &&
            this.data.status[1] === jobStatus.PENDING) {
            return this.data.query.onerror;
        }
    }
};

JobFallback.prototype.setQuery = function (query) {
    if (!JobFallback.is(query)) {
        throw new Error('You must indicate a valid SQL');
    }

    JobFallback.super_.prototype.setQuery.call(this, query);
};

// jshint maxcomplexity: 18
JobFallback.prototype.setStatus = function (finalStatus) {
    var now = new Date().toISOString();
    var initialStatus;
    var isValid;

    if (Array.isArray(this.data.status)) {
        initialStatus = this.data.status[0];
    } else {
        initialStatus = this.data.status;
    }

    if (initialStatus === jobStatus.PENDING || initialStatus === jobStatus.RUNNING) {
        isValid = false;
        for (var i = 0; i < this.data.query.query.length; i++) {
            if (Array.isArray(this.data.query.query[i].status)) {
                for (var j = 0; j < this.data.query.query[i].status.length; j++) {
                    isValid = JobFallback.super_.prototype.isValidStatusTransition(
                        this.data.query.query[i].status[j], finalStatus
                    );

                    if (isValid) {
                        this.data.query.query[i].status[j] = finalStatus;
                        break;
                    }
                }

                if (isValid) {
                    break;
                }
            } else {
                isValid = JobFallback.super_.prototype.isValidStatusTransition(
                    this.data.query.query[i].status, finalStatus
                );

                if (isValid) {
                    this.data.query.query[i].status = finalStatus;
                    break;
                }
            }
        }

        if (!isValid) {
            throw new Error('Cannot set status from ' + initialStatus + ' to ' + finalStatus);
        }
    }


    // if transition is to "done" and there are more queries to run
    // then job status must be "pending" instead of "done"
    // else job status transition to done (if "running")
    if (finalStatus === jobStatus.DONE && this.hasNextQuery()) {
        finalStatus = jobStatus.PENDING;
    } else if (finalStatus === jobStatus.FAILED && this.hasNextQuery()) {
        finalStatus = jobStatus.PENDING;
    }

    isValid = false;
    if (Array.isArray(this.data.status)) {
        for (var k = 0; k < this.data.status.length; k++) {
            isValid = JobFallback.super_.prototype.isValidStatusTransition(this.data.status[k], finalStatus);
            if (isValid) {
                this.data.status[k] = finalStatus;
                break;
            }
        }
    } else {
        isValid = JobFallback.super_.prototype.isValidStatusTransition(this.data.status, finalStatus);
        if (isValid) {
            this.data.status = finalStatus;
        }
    }

    if (!isValid) {
        throw new Error('Cannot set status from ' + initialStatus + ' to ' + finalStatus);
    }

    this.data.updated_at = now;
};
