'use strict';

var _ = require('underscore');

function CacheStatusController(tableCache) {
    this.tableCache = tableCache;
}

CacheStatusController.prototype.route = function (app) {
    app.get(global.settings.base_url + '/cachestatus', this.handleCacheStatus.bind(this));
};

CacheStatusController.prototype.handleCacheStatus = function (req, res) {
    var tableCacheValues = this.tableCache.values();
    var totalExplainKeys = tableCacheValues.length;
    var totalExplainHits = _.reduce(tableCacheValues, function(memo, res) {
        return memo + res.hits;
    }, 0);

    res.send({
        explain: {
            pid: process.pid,
            hits: totalExplainHits,
            keys : totalExplainKeys
        }
    });
};

module.exports = CacheStatusController;
