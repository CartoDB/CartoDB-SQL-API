'use strict';

var JobSimple = require('./job-simple');
var JobMultiple = require('./job-multiple');
var JobFallback = require('./job-fallback');

var Models = [JobSimple, JobMultiple, JobFallback];

function JobFactory () {
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
