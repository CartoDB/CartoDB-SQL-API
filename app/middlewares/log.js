'use strict';

const MAX_SQL_LENGTH = 2048;

module.exports = function log() {
    return function logMiddleware(req, res, next) {
        const logObj = {
            request: {
                sql: prepareSQL(res.locals.sql)
            }
        }

        res.set('X-SQLAPI-Log', JSON.stringify(logObj));

        return next();
    };
};

function prepareSQL(sql) {
    if (!sql) {
        return null;
    }

    if (typeof sql === 'string') {
        return {
            simple: sql.substring(0, MAX_SQL_LENGTH)
        }
    }

    if (Array.isArray(sql)) {
        return {
            multiple: sql.map(q => q.substring(0, MAX_SQL_LENGTH))
        }
    }

    return {
        other: sql
    }

}
