'use strict';

var util = require('util');
var JobBase = require('./job-base');
var jobStatus = require('../job-status');

function JobSimple(jobDefinition) {
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
