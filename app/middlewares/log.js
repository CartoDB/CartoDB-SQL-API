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
    return (sql && sql.substring(0, MAX_SQL_LENGTH)) || null;
}
