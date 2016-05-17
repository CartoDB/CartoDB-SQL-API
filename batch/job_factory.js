'use strict';

var jobModels = require('./models');

function JobFactory() {
}

module.exports = JobFactory;

JobFactory.create = function (data) {
    if (!data.query) {
        throw new Error('You must indicate a valid SQL');
    }

    for (var i = 0; i < jobModels.length; i++) {
        if (jobModels[i].is(data.query)) {
            return new jobModels[i](data);
        }
    }

    throw new Error('there is no job class for the provided query');
};
