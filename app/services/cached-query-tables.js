var QueryTables = require('cartodb-query-tables');

var generateMD5 = require('../utils/md5');

function CachedQueryTables(tableCache) {
    this.tableCache = tableCache;
}

module.exports = CachedQueryTables;

CachedQueryTables.prototype.getAffectedTablesFromQuery = function(pg, sql, skipCache, callback) {
    var self = this;

    var cacheKey = sqlCacheKey(pg.username(), sql);

    var cachedResult;
    if (!skipCache) {
        cachedResult = this.tableCache.peek(cacheKey);
    }

    if (cachedResult) {
        cachedResult.hits++;
        return callback(null, cachedResult.result);
    } else {
        QueryTables.getAffectedTablesFromQuery(pg, sql, function(err, result) {
            if (err) {
                return callback(err);
            }

            self.tableCache.set(cacheKey, {
                result: result,
                hits: 0
            });

            return callback(null, result);
        });
    }
};

function sqlCacheKey(user, sql) {
    return user + ':' + generateMD5(sql);
}
