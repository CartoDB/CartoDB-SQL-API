'use strict';

var queryDetector = require('./query_detector');

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
    if (job.status === 'pending') {
        return {
            query: job.query
        };
    }
}

function getMultipleNextQuery(job) {
    for (var i = 0; i < job.query.length; i++) {
        if (job.query[i].status === 'failed') {
            break;
        }

        if (job.query[i].status === 'pending') {
            return {
                index: i,
                query: job.query[i].query
            };
        }
    }
}

function getFallbackNextQuery(job) {
    // jshint maxcomplexity
    var jobOnSuccess = job.query.onsuccess;
    var jobOnError = job.query.onerror;
    var muliquery = job.query.query;
    var nextQuery;
    var jobStatuses = job.status.split(',');
    var jobStatus = jobStatuses[0];
    var jobFallbackStatus = jobStatuses[1];

    for (var j = 0; j < muliquery.length; j++) {
        var query = muliquery[j].query;
        var statuses = muliquery[j].status.split(',');
        var queryOnSuccess = muliquery[j].onsuccess;
        var queryOnError = muliquery[j].onerror;
        var queryStatus = statuses[0];
        var fallbackStatus = statuses[1];

        if (queryStatus === 'pending') {
            nextQuery = {
                index: j,
                query: query,
            };
            break;
        } else if (queryStatus === 'done' && queryOnSuccess && !fallbackStatus) {
            nextQuery = {
                index: j,
                query: queryOnSuccesss,
            };
            break;
        } else if (queryStatus === 'failed' && queryOnError && !fallbackStatus) {
            nextQuery = {
                index: j,
                query: queryOnError,
            };
            break;
        } else if (queryStatus === 'failed' && jobOnError) {
            nextQuery = {
                query: jobOnError,
            };
            break;
        }
    }

    if (!nextQuery) {
        if (queryStatus === 'done' && jobOnSuccess) {
            nextQuery = {
                query: jobOnSuccess,
            };
        }
    }

    return nextQuery;
}
