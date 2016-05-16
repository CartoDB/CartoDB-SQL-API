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

JobFallback.prototype.init = function () {
    for (var i = 0; i < this.data.query.query.length; i++) {
        if (this.data.query[i].onsuccess || this.data.query[i].onerror) {
            this.data.query.query[i].status = [ jobStatus.PENDING, jobStatus.PENDING ];
        } else {
            this.data.query.query[i].status = jobStatus.PENDING;
        }
    }

    if (this.data.query.onsuccess || this.data.query.onerror) {
        this.data.status = [ jobStatus.PENDING, jobStatus.PENDING ];
    } else {
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

// jshint maxcomplexity: 10
JobFallback.prototype.getNextQuery = function () {
    for (var i = 0; i < this.data.query.query[i].length; i++) {
        if (Array.isArray(this.data.query.query[i].status)) {
            if (this.data.query.query[i].status[0] === jobStatus.PENDING) {
                return this.data.query.query[i].query;
            } else if (this.data.query.query[i].status[0] === jobStatus.DONE && this.data.query.query[i].onsuccess) {
                return this.data.query.query[i].onsuccess;
            } else if (this.data.query.query[i].status[0] === jobStatus.FAILED && this.data.query.query[i].onerror) {
                return this.data.query.query[i].onerror;
            }
        } else if (this.data.query.query[i].status === jobStatus.PENDING) {
            return this.data.query.query[i].query;
        }
    }

    if (Array.isArray(this.data.status)) {
        if (this.data.status[0] === jobStatus.DONE && this.data.query.onsuccess) {
            return this.data.query.onsuccess;
        } else if (this.data.status[0] === jobStatus.FAILED &&  this.data.query.onerror) {
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

JobFallback.prototype.setStatus = function (finalStatus) {
    var initialStatus = this.data.status;

    // if transition is to "done" and there are more queries to run
    // then job status must be "pending" instead of "done"
    // else job status transition to done (if "running")
    if (finalStatus === jobStatus.DONE && this.hasNextQuery()) {
        JobFallback.super_.prototype.setStatus.call(this, jobStatus.PENDING);
    } else {
        JobFallback.super_.prototype.setStatus.call(this, finalStatus);
    }

    for (var i = 0; i < this.data.query.length; i++) {
        var isValid = JobFallback.super_.prototype.isValidStatusTransition(
            this.data.query.query[i].status, finalStatus
        );

        if (isValid) {
            this.data.query.query[i].status = finalStatus;
            return;
        }
    }

    throw new Error('Cannot set status from ' + initialStatus + ' to ' + finalStatus);
};
