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
        getLastUpdatedTime(connectionParams, queryExplainResult.affectedTables, function(err, lastUpdatedTime) {
            return callback(null, {
                affectedTables: queryExplainResult.affectedTables,
                lastModified: lastUpdatedTime,
                mayWrite: queryExplainResult.mayWrite
            });
        });
    } else {
        getAffectedTablesAndLastUpdatedTime(connectionParams, sql, function(err, affectedTablesAndLastUpdatedTime) {
            var queryExplainResult = {
                affectedTables: affectedTablesAndLastUpdatedTime.affectedTables,
                mayWrite: queryMayWrite(sql),
                hits: 1
            };

            self.tableCache.set(cacheKey, queryExplainResult);

            return callback(null, {
                affectedTables: queryExplainResult.affectedTables,
                lastModified: affectedTablesAndLastUpdatedTime.lastUpdatedTime,
                mayWrite: queryExplainResult.mayWrite
            });
        });
    }
};

function getAffectedTablesAndLastUpdatedTime(connectionParams, sql, callback) {
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

        return callback(null, {
            affectedTables: tableNames,
            lastUpdatedTime: lastUpdatedTime
        });
    }, true);
}

function getLastUpdatedTime(connectionParams, tableNames, callback) {
    if (!Array.isArray(tableNames) || tableNames.length === 0) {
        return callback(null, Date.now());
    }

    var query = [
        'SELECT EXTRACT(EPOCH FROM max(updated_at)) as max',
        'FROM CDB_TableMetadata m WHERE m.tabname = any (ARRAY[',
            tableNames.map(function(t) { return "'" + t + "'::regclass"; }).join(','),
        '])'
    ].join(' ');

    var pg = new PSQL(connectionParams, {}, { destroyOnError: true });

    pg.query(query, function handleLastUpdatedTimeRows (err, resultSet) {
        resultSet = resultSet || {};
        var rows = resultSet.rows || [];

        var result = rows[0] || {};

        var lastUpdatedTime = (Number.isFinite(result.max)) ? (result.max * 1000) : Date.now();

        return callback(null, lastUpdatedTime);
    }, true);
}

function logIfError(err, sql, rows) {
    if (err || rows.length !== 1) {
        var errorMessage = (err && err.message) || 'unknown error';
        console.error("Error on query explain '%s': %s", sql, errorMessage);
    }
}

function sqlCacheKey(user, sql) {
    return user + ':' + generateMD5(sql);
}
