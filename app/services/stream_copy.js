'use strict';

const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;

const ACTION_TO = 'to';
const ACTION_FROM = 'from';
const DEFAULT_TIMEOUT = "'5h'";

const cancelQuery = pid => `SELECT pg_cancel_backend(${pid}) as cancelled`;
const terminateQuery = pid => `SELECT pg_terminate_backend(${pid}) as terminated`;
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

                this.stream = action === ACTION_TO ? copyTo(this.sql) : copyFrom(this.sql);

                const pgstream = client.query(this.stream);

                if (action === ACTION_TO) {
                    pgstream.on('end', () => done());
                    pgstream.on('error', () => this._cancel(client.processID, action));
                    pgstream.on('warning', (msg) => this.logger.warn(msg));
                } else if (action === ACTION_FROM) {
                    pgstream.on('finish', () => done());
                    pgstream.on('error', err =>  client.connection.sendCopyFail(err.message));
                }

                pgstream.on('error', err => done(err));

                callback(null, pgstream);
            });
        });
    }

    getRowCount() {
        return this.stream.rowCount;
    }

    _cancel (pid, action) {
        const pg = new PSQL(this.dbParams);
        const actionType = action === ACTION_TO ? ACTION_TO : ACTION_FROM;

        pg.query(cancelQuery(pid), (err, result) => {
            if (err) {
                return this.logger.error(err);
            }

            const isCancelled = result.rows.length && result.rows[0].cancelled;

            if (isCancelled) {
                return this.logger.info(`Canceled "copy ${actionType}" stream query successfully (pid: ${pid})`);
            }

            return pg.query(terminateQuery(pid), (err, result) => {
                if (err) {
                    return this.logger.error(err);
                }

                const isTerminated = result.rows.length && result.rows[0].terminated;

                if (!isTerminated) {
                    return this.logger.error(
                        new Error(`Unable to terminate "copy ${actionType}" stream query (pid: ${pid})`)
                    );
                }

                return this.logger.info(`Terminated "copy ${actionType}" stream query successfully (pid: ${pid})`);
            });
        });
    }
};
