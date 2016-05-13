'use strict';

var JobSimple = require('job_simple');
var JobMultiple = require('job_multiple');

function JobFactory() {
    this.jobClasses = [ JobSimple, JobMultiple ];
}

module.exports = JobFactory;

JobFactory.create = function (data) {
    if (!data.query) {
        throw new Error('param "query" is mandatory');
    }

    for (var i = 0; i < this.jobClasses.length; i++) {
        if (this.jobClasses[i].is(data.query)) {
            return new this.jobClasses[i](data);
        }
    }

    throw new Error('there is no job class for the provided query');
};
