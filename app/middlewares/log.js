'use strict';

const { stringifyForLogs } = require('../utils/logs');

const MAX_SQL_LENGTH = (global.settings.logQueries && global.settings.maxQueriesLogLength) || 1024;
const TYPES = {
    QUERY: 'query',
    JOB: 'job'
};

module.exports = function log(sqlType = TYPES.QUERY) {
    return function logMiddleware(req, res, next) {
        const logObj = {
            request: {
                sql: prepareSQL(res.locals.sql, sqlType)
            }
        };

        res.set('X-SQLAPI-Log', stringifyForLogs(logObj));

        return next();
    };
};

module.exports.TYPES = TYPES;

function prepareSQL(sql, sqlType) {
    if (!sql || !global.settings.logQueries) {
        return null;
    }


    if (typeof sql === 'string') {
        return {
            type: sqlType,
            sql: ensureMaxQueryLength(sql)
        };
    }

    if (Array.isArray(sql)) {
        return {
            type: sqlType,
            sql: sql.map(q => ensureMaxQueryLength(q))
        };
    }

    if (sql.query && Array.isArray(sql.query)) {
        return {
            type: sqlType,
            sql: prepareBatchFallbackQuery(sql)
        };
    }
}

/**
 * Process a Batch API fallback query controlling the queries length
 * We need to create a new object avoiding original modifications
 *
 * @param {Object} sql
 */
function prepareBatchFallbackQuery(sql) {
    const fallbackQuery = {};

    if (sql.onsuccess) {
        fallbackQuery.onsuccess = ensureMaxQueryLength(sql.onsuccess);
    }

    if (sql.onerror) {
        fallbackQuery.onerror = ensureMaxQueryLength(sql.onerror);
    }

    fallbackQuery.query = sql.query.map(query => {
        const subquery = {
            query: ensureMaxQueryLength(query.query)
        };

        if (query.onsuccess) {
            subquery.onsuccess = ensureMaxQueryLength(query.onsuccess);
        }

        if (query.onerror) {
            subquery.onerror = ensureMaxQueryLength(query.onerror);
        }

        return subquery;
    });

    return fallbackQuery;
}

function ensureMaxQueryLength(sql) {
    return sql.substring(0, MAX_SQL_LENGTH);
}
