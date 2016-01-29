'use strict';

module.exports = function generateCacheKey(database, affectedTables) {
    return database + ":" + affectedTables.join(',');
};
