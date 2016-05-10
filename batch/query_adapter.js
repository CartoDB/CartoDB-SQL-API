'use strict';

var queryDetector = require('./queryDetector');

var isSimple = queryDetector.isSimple;
var isMultiple = queryDetector.isMultiple;
var isFallback = queryDetector.isFallback;
var isFallbackNode = queryDetector.isFallbackNode;

module.exports = function adapt(query) {
    var adaptedQuery;

    if (isSimple(query)) {
        adaptedQuery = query;
    } else if (isMultiple(query)) {
        adaptedQuery = parseMultiple(query);
    } else if (isFallback(query)) {
        adaptedQuery = parseFallback(query);
    } else {
        throw new Error('Invalid query');
    }

    return adaptedQuery;
};

function parseMultiple(multiple) {
    return multiple.map(function (query) {
        if (!isSimple(query)) {
            throw new Error('Invalid query');
        }

        return {
            query: query,
            status: 'pending'
        };
    });
}

function parseFallback(fallback) {
    var parsedFallback = {
        query: {}
    };

    parsedFallback.query = fallback.query.map(function (query) {
        if (isSimple(query)) {
            return {
                query: query,
                status: 'pending'
            };
        }
        if (isFallbackNode(query)) {
            query.status = 'pending';
            return query;
        }

        throw new Error('Invalid query');
    });

    if (fallback.onsuccess) {
        parsedFallback.onsuccess = fallback.onsuccess;
    }

    if (fallback.onerror) {
        parsedFallback.onerror = fallback.onerror;
    }

    return parsedFallback;
}
