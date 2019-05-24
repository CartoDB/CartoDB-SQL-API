'use strict';

const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;

const ACTION_TO = 'to';
const ACTION_FROM = 'from';
const DEFAULT_TIMEOUT = "'5h'";

const cancelQuery = pid => `SELECT pg_cancel_backend(${pid})`;
const timeoutQuery = timeout => `SET statement_timeout=${timeout}`;

module.exports = class StreamCopy {
    constructor(sql, userDbParams, logger) {
        this.dbParams = Object.assign({}, userDbParams, {
            port: global.settings.db_batch_port || userDbParams.port
        });
        this.sql = sql;
        this.stream = null;
        this.timeout = global.settings.copy_timeout || DEFAULT_TIMEOUT;
        this.logger = logger;
    }

    static get ACTION_TO() {
        return ACTION_TO;
    }

    static get ACTION_FROM() {
        return ACTION_FROM;
    }

    getPGStream(action, callback) {
        this.action = action;
        const pg = new PSQL(this.dbParams);

        pg.connect((err, client, done) => {
            if (err) {
                return callback(err);
            }

            client.query(timeoutQuery(this.timeout), (err) => {
                if (err) {
                    return callback(err);
                }

                this.clientProcessID = client.processID;

                this.stream  = action === ACTION_TO ? copyTo(this.sql) : copyFrom(this.sql);

                const pgstream = client.query(this.stream);

                if (action === ACTION_TO) {
                    pgstream.on('end', () => done());
                } else if (action === ACTION_FROM) {
                    pgstream.on('finish', () => done());
                }

                pgstream.on('error', err => done(err));

                callback(null, pgstream);
            });
        });
    }

    getRowCount() {
        return this.stream.rowCount;
    }

    cancel () {
        const pid = this.clientProcessID;
        const pg = new PSQL(this.dbParams);

        pg.query(cancelQuery(pid), (err, result) => {
            if (err) {
                return this.logger.error(err);
            }

            const actionType = this.action === ACTION_TO ? ACTION_TO : ACTION_FROM;
            const isCancelled = result.rows[0].pg_cancel_backend;

            if (!isCancelled) {
                return this.logger.error(new Error(`Unable to cancel "copy ${actionType}" stream query (pid: ${pid})`));
            }

            return this.logger.info(`Canceled "copy ${actionType}" stream query successfully (pid: ${pid})`);
        });
    }
};
