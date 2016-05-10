'use strict';

var queryDetector = require('./queryDetector');

var isSimple = queryDetector.isSimple;
var isMultiple = queryDetector.isMultiple;
var isFallback = queryDetector.isFallback;

module.exports = function getNextQuery(job) {
    if (isSimple(job.query)) {
        return getSimpleNextQuery(job);
    } else if (isMultiple(job.query)) {
        return getMultipleNextQuery(job);
    } else if (isFallback(job.query)) {
        return getFallbackNextQuery(job);
    }
};

function getSimpleNextQuery(job) {
    return {
        query: job.query
    };
}

function getMultipleNextQuery(job) {
    for (var i = 0; i < job.query.length; i++) {
        if (job.query[i].status === 'pending') {
            return {
                index: i,
                query: job.query[i].query
            };
        }
    }
}

function getFallbackNextQuery(job) {
    return job;
}
