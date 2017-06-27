'use strict';

var LRU = require('lru-cache');
var NoCache = require('./no_cache');

/**
 * This module abstracts the creation of a tableCache,
 * depending on the configuration passed along
 */

function TableCacheFactory() {
}

module.exports = TableCacheFactory;

TableCacheFactory.prototype.build = function (config) {
    var enabled = config.enabled || false;
    var tableCache = enabled ? LRU(config) : new NoCache();
    return tableCache;
};
