'use strict';

function JobAdapter() {
}

module.exports = JobAdapter;

// jshint maxcomplexity: 8
JobAdapter.prototype.adapt = function (query) {
    var adaptedQuery = {};

    if (typeof query === 'string') {
        adaptedQuery = [ parseString(query) ];
    } else if (query instanceof Array) {
        adaptedQuery = parseArray(query);
    } else if (typeof query === 'object' && query !== null && query.query instanceof Array) {
        adaptedQuery = parseArray(query.query);
    } else {
        throw new Error('Invalid query');
    }

    adaptedQuery = { query: adaptedQuery };

    if (query.onsuccess && typeof query.onsuccess !== 'string') {
        throw new Error('Invalid query');
    } else if (query.onsuccess) {
        adaptedQuery.onsuccess = query.onsuccess;
    }

    if (query.onerror && typeof query.onerror !== 'string') {
        throw new Error('Invalid query');
    } else if (query.onerror) {
        adaptedQuery.onerror = query.onerror;
    }

    return adaptedQuery;
};

function parseArray(queries) {
    return queries.map(function (query) {
        if (typeof query === 'string') {
            return parseString(query);
        } else if (typeof query === 'object') {
            return parseObject(query);
        }
    });
}

function parseString(query) {
    if (typeof query !== 'string') {
        throw new Error('Invalid query');
    }

    return {
        query: query,
        status: 'pending'
    };
}

function parseObject(query) {
    var parsedQuery = parseString(query.query);

    if (query.onsuccess) {
        parsedQuery.onsuccess = query.onsuccess;
    }

    if (query.onerror) {
        parsedQuery.onerror = query.onerror;
    }

    return parsedQuery;
}
