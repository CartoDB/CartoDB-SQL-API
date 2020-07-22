'use strict';

const PSQL = require('cartodb-psql');
const queryTables = require('cartodb-query-tables').queryTables;

module.exports = function affectedTables () {
    return function affectedTablesMiddleware (req, res, next) {
        const { logger } = res.locals;
        const { sql } = res.locals.params;
        const { authDbParams } = res.locals;
        const pg = new PSQL(authDbParams);

        queryTables.getQueryMetadataModel(pg, sql)
            .then(affectedTables => {
                res.locals.affectedTables = affectedTables;

                req.profiler.done('queryExplain');

                return next();
            })
            .catch(err => {
                logger.warn({ exception: err }, 'Error on query explain');

                return next();
            });
    };
};
