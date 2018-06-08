const zlib = require('zlib');
const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;
const StreamCopyMetrics = require('./stream_copy_metrics');
const { Client } = require('pg');

module.exports = class StreamCopy {
    constructor(logger) {
        this.logger = logger;
    }

    to(res, sql, userDbParams, user, cb) {
        let metrics = new StreamCopyMetrics(this.logger, 'copyto', sql, user);

        const pg = new PSQL(userDbParams);
        pg.connect(function (err, client, done) {
            if (err) {
                return cb(err);
            }

            let responseEnded = false;
            let connectionClosedByClient = false;
            const copyToStream = copyTo(sql);
            const pgstream = client.query(copyToStream);

            res
                .on('error', err => {
                    metrics.end(null, err);
                    pgstream.unpipe(res);
                    done();
                    return cb(err);
                })
                .on('close', () => {
                    if (!responseEnded) {
                        connectionClosedByClient = true;
                        // Cancel the running COPY TO query
                        // See https://www.postgresql.org/docs/9.5/static/protocol-flow.html#PROTOCOL-COPY
                        const runningClient = client;
                        const cancelingClient = new Client(runningClient.connectionParameters);
                        cancelingClient.cancel(runningClient, pgstream);

                        const err = new Error('Connection closed by client');
                        metrics.end(null, err);
                        pgstream.unpipe(res);
                        // see https://node-postgres.com/api/pool#releasecallback
                        done(err);
                        return cb(err);
                    }
                })
                .on('end', () => responseEnded = true);

            pgstream
                .on('error', err => {
                    if (!connectionClosedByClient) {
                        metrics.end(null, err);
                        pgstream.unpipe(res);
                        done(err);
                        return cb(err);
                    }
                })
                .on('data', data => metrics.addSize(data.length))
                .on('end', () => {
                    metrics.end(copyToStream.rowCount);
                    done();
                    return cb(null, metrics);
                })
                .pipe(res);
        });
    }

    from(req, sql, userDbParams, user, gzip, cb) {
        let metrics = new StreamCopyMetrics(this.logger, 'copyfrom', sql, user, gzip);

        const pg = new PSQL(userDbParams);
        pg.connect(function (err, client, done) {
            if (err) {
                return cb(err);
            }

            let copyFromStream = copyFrom(sql);
            const pgstream = client.query(copyFromStream);
            pgstream
                .on('error', err => {
                    metrics.end(null, err);
                    req.unpipe(pgstream);
                    done();
                    return cb(err);
                })
                .on('end', function () {
                    metrics.end(copyFromStream.rowCount);
                    done();
                    return cb(null, metrics);
                });

            let requestEnded = false;

            req
                .on('error', err => {
                    metrics.end(null, err);
                    req.unpipe(pgstream);
                    pgstream.end();
                    done();
                    return cb(err);
                })
                .on('close', () => {
                    if (!requestEnded) {
                        const err = new Error('Connection closed by client');
                        metrics.end(null, err);
                        const connection = client.connection;
                        connection.sendCopyFail('CARTO SQL API: Connection closed by client');
                        req.unpipe(pgstream);
                        done();
                        return cb(err);
                    }
                })
                .on('data', data => {
                    if (gzip) {
                        metrics.addGzipSize(data.length);
                    } else {
                        metrics.addSize(data.length);
                    }
                })
                .on('end', () => requestEnded = true);

            if (gzip) {
                req
                    .pipe(zlib.createGunzip())
                    .on('data', data => metrics.addSize(data.length))
                    .pipe(pgstream);
            } else {
                req.pipe(pgstream);
            }
        });
    }
};
