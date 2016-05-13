'use strict';

var util = require('util');
var JobBase = require('./job_base');

function JobSimple(data) {
    JobBase.call(this, data);
}
util.inherits(JobSimple, JobBase);

module.exports = JobSimple;

JobSimple.prototype.is = function (query) {
    return typeof query === 'string';
};

JobSimple.prototype.hasNextQuery = function () {
    return this.isPending();
};

JobSimple.prototype.getNextQuery = function () {
    if (this.hasNextQuery()) {
        return this.data.query;
    }
};

JobSimple.prototype.setQuery = function (query) {
    var isSimple = this.is(query);

    if (this.isPending() && isSimple) {
        this.data.query = query;
    }
};

JobSimple.prototype.set = function (data) {
    JobSimple.super_.prototype.set.call(this, data);

    if (data.status) {
        this.setStatus(data.status);
    }

    if (data.query) {
        this.setQuery(data.query);
    }
};
