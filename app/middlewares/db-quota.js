const PSQL = require('cartodb-psql');

module.exports = function dbQuota () {
    return function dbQuotaMiddleware (req, res, next) {
        const { userDbParams } = res.locals;
        const pg = new PSQL(userDbParams);
        pg.connect((err, client, done) => {
            if (err) {
                return next(err);
            }
            client.query('SELECT _CDB_UserQuotaInBytes() - CDB_UserDataSize(current_schema())', (err, res) => {
                if(err) {
                    return next(err);
                }
                console.warn(res);
                done();
                next();
            });
        });
    };
};
