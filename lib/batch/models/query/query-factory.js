'use strict';

var QueryFallback = require('./query-fallback');

function QueryFactory () {
}

module.exports = QueryFactory;

QueryFactory.create = function (job, index) {
    if (QueryFallback.is(job.query.query[index])) {
        return new QueryFallback(job, index);
    }

    throw new Error('there is no query class for the provided query');
};
