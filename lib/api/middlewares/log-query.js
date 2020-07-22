'use strict';

const MAX_SQL_LENGTH = (global.settings.logQueries && global.settings.maxQueriesLogLength) || 1024;

module.exports = function logQuery () {
    if (!global.settings.logQueries) {
        return function noopLogQuery (req, res, next) {
            return next();
        };
    }

    return function logQueryMiddleware (req, res, next) {
        const { logger } = res.locals;

        logger.info({ sql: ensureMaxQueryLength(res.locals.params.sql) }, 'Input query');

        return next();
    };
};

function ensureMaxQueryLength (sql, length = MAX_SQL_LENGTH) {
    return sql.substring(0, length);
}
