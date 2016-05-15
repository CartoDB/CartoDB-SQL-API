'use strict';

var JobSimple = require('./job_simple');
var JobMultiple = require('./job_multiple');
var jobClasses = [ JobSimple, JobMultiple ];

function JobFactory() {
}

module.exports = JobFactory;

JobFactory.create = function (data) {
    if (!data.query) {
        throw new Error('You must indicate a valid SQL');
    }

    for (var i = 0; i < jobClasses.length; i++) {
        if (jobClasses[i].is(data.query)) {
            return new jobClasses[i](data);
        }
    }

    throw new Error('there is no job class for the provided query');
};
