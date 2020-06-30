'use strict';

var util = require('util');
var JobBase = require('./job-base');
var jobStatus = require('../job-status');

function JobSimple (jobDefinition) {
    JobBase.call(this, jobDefinition);

    if (!this.data.status) {
        this.data.status = jobStatus.PENDING;
    }
}
util.inherits(JobSimple, JobBase);

module.exports = JobSimple;

JobSimple.is = function (query) {
    return typeof query === 'string';
};

JobSimple.prototype.getNextQuery = function () {
    if (this.isPending()) {
        return this.data.query;
    }
};

JobSimple.prototype.setQuery = function (query) {
    if (!JobSimple.is(query)) {
        throw new Error('You must indicate a valid SQL');
    }

    JobSimple.super_.prototype.setQuery.call(this, query);
};

JobSimple.prototype.toJSON = function () {
    return {
        class: this.constructor.name,
        id: this.data.job_id,
        username: this.data.user,
        status: this.data.status,
        failed_reason: this.data.failed_reason,
        created: this.data.created_at,
        updated: this.data.updated_at,
        elapsed: elapsedTime(this.data.created_at, this.data.updated_at),
        dbhost: this.data.host
    };
};

function elapsedTime (startedAt, endedAt) {
    if (!startedAt || !endedAt) {
        return;
    }

    var start = new Date(startedAt);
    var end = new Date(endedAt);
    return end.getTime() - start.getTime();
}
