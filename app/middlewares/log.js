'use strict';

const { stringifyForLogs } = require('../utils/logs');

module.exports = function log() {
    return function logMiddleware(req, res, next) {
        const MAX_SQL_LENGTH = (global.settings.logQueries && global.settings.maxQueriesLogLength) || 1024;

        const logObj = {
            request: {
                sql: prepareSQL(res.locals.sql, MAX_SQL_LENGTH)
            }
        };

        res.set('X-SQLAPI-Log', stringifyForLogs(logObj, MAX_SQL_LENGTH));

        return next();
    };
};

function prepareSQL(sql, MAX_SQL_LENGTH) {
    if (!sql || !global.settings.logQueries) {
        return null;
    }

    if (typeof sql === 'string') {
        return {
            simple: sql.substring(0, MAX_SQL_LENGTH)
        };
    }

    if (Array.isArray(sql)) {
        return {
            multiple: sql.map(q => q.substring(0, MAX_SQL_LENGTH))
        };
    }

    return {
        other: sql
    };
}
