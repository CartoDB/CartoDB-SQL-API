'use strict';

var util = require('util');
var uuid = require('node-uuid');
var JobStateMachine = require('./job-state-machine');
var jobStatus = require('../job-status');
var mandatoryProperties = [
    'job_id',
    'status',
    'query',
    'created_at',
    'updated_at',
    'host',
    'user'
];

function JobBase (data) {
    JobStateMachine.call(this);

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
}
util.inherits(JobBase, JobStateMachine);

module.exports = JobBase;

// should be implemented by childs
JobBase.prototype.getNextQuery = function () {
    throw new Error('Unimplemented method');
};

JobBase.prototype.hasNextQuery = function () {
    return !!this.getNextQuery();
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

JobBase.prototype.setQuery = function (query) {
    var now = new Date().toISOString();

    if (!this.isPending()) {
        throw new Error('Job is not pending, it cannot be updated');
    }

    this.data.updated_at = now;
    this.data.query = query;
};

JobBase.prototype.setStatus = function (finalStatus, errorMesssage) {
    var now = new Date().toISOString();
    var initialStatus = this.data.status;
    var isValid = this.isValidTransition(initialStatus, finalStatus);

    if (!isValid) {
        throw new Error('Cannot set status from ' + initialStatus + ' to ' + finalStatus);
    }

    this.data.updated_at = now;
    this.data.status = finalStatus;
    if (finalStatus === jobStatus.FAILED && errorMesssage) {
        this.data.failed_reason = errorMesssage;
    }
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
    delete data.dbuser;
    delete data.port;
    delete data.dbname;
    delete data.pass;

    return data;
};
