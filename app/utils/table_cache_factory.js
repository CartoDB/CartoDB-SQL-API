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

TableCacheFactory.prototype.build = function (settings) {
    var enabled = settings.tableCacheEnabled || false;
    var tableCache = null;

    if(enabled) {
        tableCache = LRU({
            // store no more than these many items in the cache
            max: settings.tableCacheMax || 8192,
            // consider entries expired after these many milliseconds (10 minutes by default)
            maxAge: settings.tableCacheMaxAge || 1000*60*10
        });
    } else {
        tableCache = new NoCache();
    }

    return tableCache;
};
