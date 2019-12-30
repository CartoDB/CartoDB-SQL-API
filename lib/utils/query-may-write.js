'use strict';

var sqlQueryMayWriteRegex = new RegExp('\\b(alter|insert|update|delete|create|drop|reindex|truncate|refresh)\\b', 'i');

/**
 * This is a fuzzy check, the return could be true even if the query doesn't really write anything. But you can be
 * pretty sure of a false return.
 *
 * @param sql The SQL statement to check against
 * @returns {boolean} Return true of the given query may write to the database
 */
module.exports = function queryMayWrite (sql) {
    return sqlQueryMayWriteRegex.test(sql);
};
