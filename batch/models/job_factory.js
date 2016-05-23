'use strict';

var JobSimple = require('./job_simple');
var JobMultiple = require('./job_multiple');
var JobFallback = require('./job_fallback');

var Models = [ JobSimple, JobMultiple, JobFallback ];

function JobFactory() {
}

module.exports = JobFactory;

JobFactory.create = function (data) {
    if (!data.query) {
        throw new Error('You must indicate a valid SQL');
    }

    for (var i = 0; i < Models.length; i++) {
        if (Models[i].is(data.query)) {
            return new Models[i](data);
        }
    }

    throw new Error('there is no job class for the provided query');
};
