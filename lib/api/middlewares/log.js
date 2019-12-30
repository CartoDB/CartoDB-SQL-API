'use strict';

const { stringifyForLogs } = require('../../utils/logs');

const MAX_SQL_LENGTH = (global.settings.logQueries && global.settings.maxQueriesLogLength) || 1024;

// This is used to set a hard limit to the header size
// While Node accepts headers of up to 8192 character, different libraries impose other limits
// This might break the JSON structure of the log, but avoids responses being dropped by varnish
const HEADER_HARD_LIMIT = 4096;

const TYPES = {
    QUERY: 'query',
    JOB: 'job'
};

module.exports = function log (sqlType = TYPES.QUERY) {
    return function logMiddleware (req, res, next) {
        const logObj = {
            request: {
                sql: prepareSQL(res.locals.params.sql, sqlType)
            }
        };

        res.set('X-SQLAPI-Log', stringifyForLogs(logObj).substring(0, HEADER_HARD_LIMIT));

        return next();
    };
};

module.exports.TYPES = TYPES;

function prepareSQL (sql, sqlType) {
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
        const lengthPerQuery = MAX_SQL_LENGTH / sql.length;
        return {
            type: sqlType,
            sql: sql.map(q => ensureMaxQueryLength(q, lengthPerQuery))
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
function prepareBatchFallbackQuery (sql) {
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

function ensureMaxQueryLength (sql, length = MAX_SQL_LENGTH) {
    return sql.substring(0, length);
}
