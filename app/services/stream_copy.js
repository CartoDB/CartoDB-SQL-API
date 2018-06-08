const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;

module.exports = {
    to(sql, userDbParams, cb, next) {
        const pg = new PSQL(userDbParams);
        pg.connect(function (err, client, done) {
            if (err) {
                cb(err);
            }

            const copyToStream = copyTo(sql);
            const pgstream = client.query(copyToStream);

            pgstream
                .on('end', () => {
                    done();
                    next(null, copyToStream.rowCount);
                });

            cb(null, pgstream, client, done);
        });
    },

    from(sql, userDbParams, cb, next) {
        const pg = new PSQL(userDbParams);
        pg.connect(function (err, client, done) {
            if (err) {
                cb(err);
            }

            let copyFromStream = copyFrom(sql);
            const pgstream = client.query(copyFromStream);

            pgstream
                .on('error', err => {
                    done();
                    cb(err, pgstream);
                })
                .on('end', function () {
                    done();
                    next(null, copyFromStream.rowCount);
                });

            cb(null, pgstream, client, done);
        });
    }
};
