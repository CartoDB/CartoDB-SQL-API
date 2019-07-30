'use strict';

const PSQL = require('cartodb-psql');
const queryTables = require('cartodb-query-tables');

module.exports = function affectedTables () {
    return function affectedTablesMiddleware (req, res, next) {
        const { sql } = res.locals.params;
        const { authDbParams } = res.locals;
        const pg = new PSQL(authDbParams);

        queryTables.getAffectedTablesFromQuery(pg, sql, (err, affectedTables) => {
            if (err) {
                const message = (err && err.message) || 'unknown error';
                console.error('Error on query explain \'%s\': %s', sql, message);

                return next();
            }

            res.locals.affectedTables = affectedTables;

            if (req.profiler) {
                req.profiler.done('queryExplain');
            }

            return next();
        });

    };
};
