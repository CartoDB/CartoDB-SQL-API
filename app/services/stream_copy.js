const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;
const { Client } = require('pg');

const ACTION_TO = 'to';
const ACTION_FROM = 'from';
const DEFAULT_TIMEOUT = "'5h'";

module.exports = class StreamCopy {

    constructor(sql, userDbParams) {
        const dbParams = Object.assign({}, userDbParams, {
            port: global.settings.db_batch_port || userDbParams.port
        });
        this.pg = new PSQL(dbParams);
        this.sql = sql;
        this.stream = null;
        this.timeout = global.settings.copy_timeout || DEFAULT_TIMEOUT;
    }

    static get ACTION_TO() {
        return ACTION_TO;
    }

    static get ACTION_FROM() {
        return ACTION_FROM;
    }

    getPGStream(action, cb) {
        this.pg.connect((err, client, done) => {
            if (err) {
                return cb(err);
            }

            client.query('SET statement_timeout=' + this.timeout, (err) => {

                if (err) {
                    return cb(err);
                }

                const streamMaker = action === ACTION_TO ? copyTo : copyFrom;
                this.stream = streamMaker(this.sql);
                const pgstream = client.query(this.stream);

                pgstream
                    .on('end', () => {
                        if(action === ACTION_TO) {
                            pgstream.connection.stream.resume();
                        }
                        done();
                    })
                    .on('error', err => done(err))
                    .on('cancelQuery', err => {
                        if(action === ACTION_TO) {
                            // See https://www.postgresql.org/docs/9.5/static/protocol-flow.html#PROTOCOL-COPY
                            const cancelingClient = new Client(client.connectionParameters);
                            cancelingClient.cancel(client, pgstream);

                            // see https://node-postgres.com/api/pool#releasecallback
                            return done(err);
                        } else if (action === ACTION_FROM) {
                            client.connection.sendCopyFail('CARTO SQL API: Connection closed by client');
                        }
                    });

                cb(null, pgstream);
            });
        });
    }

    getRowCount() {
        return this.stream.rowCount;
    }
};
