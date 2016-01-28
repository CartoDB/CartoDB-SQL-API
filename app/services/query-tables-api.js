var PSQL = require('cartodb-psql');

var generateMD5 = require('../utils/md5');
var queryMayWrite = require('../utils/query_may_write');

function QueryTablesApi(tableCache) {
    this.tableCache = tableCache;
}

module.exports = QueryTablesApi;

QueryTablesApi.prototype.getAffectedTablesAndLastUpdatedTime = function (connectionParams, sql, callback) {
    var self = this;

    var cacheKey = sqlCacheKey(connectionParams.user, sql);
    var queryExplainResult = this.tableCache.get(cacheKey);

    if (queryExplainResult) {
        queryExplainResult.hits++;
        return callback(null, queryExplainResult);
    }


    var query = [
        'WITH querytables AS (',
            'SELECT * FROM CDB_QueryTablesText($quotesql$' + sql + '$quotesql$) as tablenames',
        ')',
        'SELECT (SELECT tablenames FROM querytables), EXTRACT(EPOCH FROM max(updated_at)) as max',
        'FROM CDB_TableMetadata m',
        'WHERE m.tabname = any ((SELECT tablenames from querytables)::regclass[])'
    ].join(' ');

    var pg = new PSQL(connectionParams, {}, { destroyOnError: true });

    pg.query(query, function handleAffectedTablesAndLastUpdatedTimeRows(err, resultSet) {
        resultSet = resultSet || {};
        var rows = resultSet.rows || [];

        logIfError(err, sql, rows);

        var result = rows[0] || {};

        // This is an Array, so no need to split into parts
        var tableNames = result.tablenames || [];
        var lastUpdatedTime = (Number.isFinite(result.max)) ? (result.max * 1000) : Date.now();

        var queryExplainResult = {
            affectedTables: tableNames,
            lastModified: lastUpdatedTime,
            mayWrite: queryMayWrite(sql),
            hits: 1
        };

        self.tableCache.set(cacheKey, queryExplainResult);

        return callback(null, queryExplainResult);
    }, true);
};

function logIfError(err, sql, rows) {
    if (err || rows.length !== 1) {
        var errorMessage = (err && err.message) || 'unknown error';
        console.error("Error on query explain '%s': %s", sql, errorMessage);
    }
}

function sqlCacheKey(user, sql) {
    return user + ':' + generateMD5(sql);
}
