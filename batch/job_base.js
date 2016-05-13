'use strict';

var assert = require('assert');
var uuid = require('node-uuid');
var jobStatus = require('./job_status');
var validStatusTransitions = [
    [jobStatus.PENDING, jobStatus.RUNNING],
    [jobStatus.PENDING, jobStatus.CANCELLED],
    [jobStatus.PENDING, jobStatus.UNKNOWN],
    [jobStatus.RUNNING, jobStatus.DONE],
    [jobStatus.RUNNING, jobStatus.FAILED],
    [jobStatus.RUNNING, jobStatus.CANCELLED],
    [jobStatus.RUNNING, jobStatus.PENDING],
    [jobStatus.RUNNING, jobStatus.UNKNOWN]
];
var mandatoryProperties = [
    'job_id',
    'status',
    'query',
    'created_at',
    'updated_at',
    'host',
    'user'
];

function JobBase(data) {
    var now = new Date().toISOString();

    this.data = data;

    if (!this.data.job_id) {
        this.data.job_id = uuid.v4();
    }

    if (!this.data.created_at) {
        this.data.created_at = now;
    }

    if (!this.data.updated_at) {
        this.data.updated_at = now;
    }

    if (!this.data.status) {
        this.data.status = jobStatus.PENDING;
    }
}

module.exports = JobBase;

JobBase.isValidStatusTransition = function (initialStatus, finalStatus) {
    var transition = [ initialStatus, finalStatus ];

    for (var i = 0; i < validStatusTransitions.length; i++) {
        try {
            assert.deepEqual(transition, validStatusTransitions[i]);
            return true;
        } catch (e) {
            continue;
        }
    }

    return false;
};

// should be implemented by childs
JobBase.prototype.getNextQuery = function () {
    throw new Error('Unimplemented method');
};

// should be implemented by childs
JobBase.prototype.hasNextQuery = function () {
    throw new Error('Unimplemented method');
};

JobBase.prototype.isPending = function () {
    return this.data.status === jobStatus.PENDING;
};

JobBase.prototype.isRunning = function () {
    return this.data.status === jobStatus.RUNNING;
};

JobBase.prototype.isDone = function () {
    return this.data.status === jobStatus.DONE;
};

JobBase.prototype.isCancelled = function () {
    return this.data.status === jobStatus.CANCELLED;
};

JobBase.prototype.isFailed = function () {
    return this.data.status === jobStatus.FAILED;
};

JobBase.prototype.isUnknown = function () {
    return this.data.status === jobStatus.UNKNOWN;
};

JobBase.prototype.set = function (data) {
    var now = new Date().toISOString();

    if (data.job_id !== this.data.job_id) {
        throw new Error('Cannot modify id');
    }

    this.data.update_at = now;
};

JobBase.prototype.setQuery = function (/* query */) {
    throw new Error('Unimplemented method');
};

JobBase.prototype.setStatus = function (finalStatus) {
    var initialStatus = this.data.status;
    var isValid = this.isValidStatusTransition(initialStatus, finalStatus);

    if (!isValid) {
        throw new Error('Cannot set status from ' + initialStatus + ' to ' + finalStatus);
    }

    this.data.status = finalStatus;
};

JobBase.prototype.validate = function () {
    for (var i = 0; i < mandatoryProperties.length; i++) {
        if (!this.data[mandatoryProperties[i]]) {
            throw new Error('property "' + mandatoryProperties[i] + '" is mandatory');
        }
    }
};

JobBase.prototype.serialize = function () {
    var data = JSON.parse(JSON.stringify(this.data));
    delete data.host;

    return data;
};
