'use strict';

module.exports = function lastModified () {
    return function lastModifiedMiddleware (req, res, next) {
        const { affectedTables } = res.locals;

        if (affectedTables) {
            const lastUpdatedAt = affectedTables.getLastUpdatedAt(Date.now());
            res.header('Last-Modified', new Date(lastUpdatedAt).toUTCString());
        }

        next();
    };
};
