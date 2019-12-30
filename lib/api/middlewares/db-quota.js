'use strict';

const PSQL = require('cartodb-psql');

const remainingQuotaQuery = 'SELECT _CDB_UserQuotaInBytes() - CDB_UserDataSize(current_schema()) AS remaining_quota';

module.exports = function dbQuota () {
    return function dbQuotaMiddleware (req, res, next) {
        const { userDbParams } = res.locals;
        const pg = new PSQL(userDbParams);
        pg.connect((err, client, done) => {
            if (err) {
                return next(err);
            }
            client.query(remainingQuotaQuery, (err, result) => {
                if (err) {
                    return next(err);
                }
                const remainingQuota = result.rows[0].remaining_quota;
                res.locals.dbRemainingQuota = remainingQuota;
                done();
                next();
            });
        });
    };
};
