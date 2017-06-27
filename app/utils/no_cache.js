'use strict';

/**
 * This module provides an object with the interface of an LRU cache
 * but that actually does not store anything.
 *
 * See https://github.com/isaacs/node-lru-cache/tree/v2.5.0
 */

function NoCache() {
}

module.exports = NoCache;

NoCache.prototype.set = function (/* key, value */) {
    return true;
};

NoCache.prototype.get = function (/* key */) {
    return undefined;
};

NoCache.prototype.peek = function (/* key */) {
    return undefined;
};

NoCache.prototype.del = function (/* key */) {
    return undefined;
};

NoCache.prototype.reset = function () {
    return undefined;
};

NoCache.prototype.has = function (/* key */) {
    return false;
};

NoCache.prototype.forEach = function (/* fn, thisp */) {
    return undefined;
};

NoCache.prototype.keys = function () {
    return [];
};

NoCache.prototype.values = function () {
    return [];
};
