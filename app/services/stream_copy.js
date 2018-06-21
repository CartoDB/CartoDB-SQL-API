const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;
const { Client } = require('pg');

const ACTION_TO = 'to';
const ACTION_FROM = 'from';

module.exports = class StreamCopy {
    constructor(sql, userDbParams) {
        this.pg = new PSQL(userDbParams);
        this.sql = sql;
        this.connectionClosedByClient = false;

        this.stream = null;
    }

    static get ACTION_TO() {
        return ACTION_TO;
    }

    static get ACTION_FROM() {
        return ACTION_FROM;
    }

    to(cb) {
        this.pg.connect((err, client, done) => {
            if (err) {
                return cb(err);
            }

            this.stream = copyTo(this.sql);
            const pgstream = client.query(this.stream);

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

            cb(null, pgstream);
        });
    }

    from(cb) {
        this.pg.connect((err, client, done) => {
            if (err) {
                return cb(err);
            }

            this.stream = copyFrom(this.sql);
            const pgstream = client.query(this.stream);

            pgstream
                .on('end', () => done())
                .on('error', err => done(err))
                .on('cancelQuery', () => {
                    client.connection.sendCopyFail('CARTO SQL API: Connection closed by client');
                });

            cb(null, pgstream);
        });
    }

    getRowCount() {
        return this.stream.rowCount;
    }
};
