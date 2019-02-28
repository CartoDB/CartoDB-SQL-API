'use strict';

const { stringifyForLogs } = require('../utils/logs');

const TYPES = {
    QUERY: 'query',
    JOB: 'job'
};

module.exports = function log(sqlType = TYPES.QUERY) {
    return function logMiddleware(req, res, next) {
        const MAX_SQL_LENGTH = (global.settings.logQueries && global.settings.maxQueriesLogLength) || 1024;

        const logObj = {
            request: {
                sql: prepareSQL(res.locals.sql, sqlType, MAX_SQL_LENGTH)
            }
        };

        res.set('X-SQLAPI-Log', stringifyForLogs(logObj, MAX_SQL_LENGTH));

        return next();
    };
};

module.exports.TYPES = TYPES;

function prepareSQL(sql, sqlType, MAX_SQL_LENGTH) {
    if (!sql || !global.settings.logQueries) {
        return null;
    }

    if (typeof sql === 'string') {
        return {
            type: sqlType,
            sql: sql.substring(0, MAX_SQL_LENGTH)
        };
    }

    if (Array.isArray(sql)) {
        return {
            type: sqlType,
            sql: sql.map(q => q.substring(0, MAX_SQL_LENGTH))
        };
    }

    // other cases from Batch API
    return {
        type: sqlType,
        sql: sql
    };
}
