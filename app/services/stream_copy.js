const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;
const { Client } = require('pg');

module.exports = class StreamCopy {
    constructor (sql, userDbParams) {
        this.pg = new PSQL(userDbParams);
        this.sql = sql;
        this.connectionClosedByClient = false;
    }

    to(cb) {
        this.pg.connect((err, client, done)  => {
            if (err) {
                return cb(err);
            }

            const copyToStream = copyTo(this.sql);
            const pgstream = client.query(copyToStream);

            pgstream
                .on('end', () => done())
                .on('error', err => done(err))
                .on('cancelQuery', err => {
                    // See https://www.postgresql.org/docs/9.5/static/protocol-flow.html#PROTOCOL-COPY
                    const cancelingClient = new Client(client.connectionParameters);
                    cancelingClient.cancel(client, pgstream);

                    // see https://node-postgres.com/api/pool#releasecallback
                    done(err);
                });

            cb(null, pgstream, copyToStream);
        });
    }

    from(cb) {
        this.pg.connect((err, client, done) => {
            if (err) {
                return cb(err);
            }

            const copyFromStream = copyFrom(this.sql);
            const pgstream = client.query(copyFromStream);

            pgstream
                .on('end', () => done())
                .on('error', err => done(err));

            cb(null, pgstream, copyFromStream, client, done);
        });
    }
};
