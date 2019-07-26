'use strict';

module.exports = function cacheChannel () {
    return function cacheChannelMiddleware (req, res, next) {
        const { affectedTables, mayWrite } = res.locals;
        const skipNotUpdatedAtTables = true;

        if (!!affectedTables && affectedTables.getTables(skipNotUpdatedAtTables).length > 0 && !mayWrite) {
            res.header('X-Cache-Channel', affectedTables.getCacheChannel(skipNotUpdatedAtTables));
        }

        next();
    };
};
