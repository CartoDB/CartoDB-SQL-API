const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;

module.exports = class StreamCopy {
    constructor (sql, userDbParams) {
        this.pg = new PSQL(userDbParams);
        this.sql = sql;
        this.connectionClosedByClient = false;
    }

    to(cb, next) {
        this.pg.connect((err, client, done)  => {
            if (err) {
                cb(err);
            }

            const copyToStream = copyTo(this.sql);
            const pgstream = client.query(copyToStream);

            pgstream
                .on('error', err => {
                    if (!this.connectionClosedByClient) {
                        done(err);
                        cb(err, pgstream);
                    }
                })
                .on('end', () => {
                    done();
                    return next(null, copyToStream.rowCount);
                });

            cb(null, pgstream, client, done);
        });
    }

    from(cb, next) {
        this.pg.connect((err, client, done) => {
            if (err) {
                cb(err);
            }

            const copyFromStream = copyFrom(this.sql);
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

    setConnectionClosedByClient(connectionClosedByClient) {
        this.connectionClosedByClient = connectionClosedByClient;
    }
};
