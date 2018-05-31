const zlib = require('zlib');
const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;
const StreamCopyMetrics = require('./stream_copy_metrics');
const { Client } = require('pg');

module.exports = {
    to (res, sql, userDbParams, logger, cb) {
        let metrics = new StreamCopyMetrics(logger, 'copyto', sql);

        const pg = new PSQL(userDbParams);
        pg.connect(function (err, client, done) {
            if (err) {
                return cb(err);
            }

            let responseEnded = false;

            res
                .on('error', err => {
                    pgstream.unpipe(res);
                    done();
                    return cb(err);
                })
                .on('close', () => {
                    if (!responseEnded) {
                        // Cancel the running COPY TO query.
                        // See https://www.postgresql.org/docs/9.5/static/protocol-flow.html#PROTOCOL-COPY
                        const runningClient = client;
                        const cancelingClient = new Client(runningClient.connectionParameters);
                        const connection = cancelingClient.connection;
                        connection.on('connect', () => {
                            connection.cancel(runningClient.processID, runningClient.secretKey);
                            done();
                        });
                        connection.connect(runningClient.port, runningClient.host);
                        return cb(new Error('Connection closed by client'));
                    }
                })
                .on('end', () => responseEnded = true);

            const copyToStream = copyTo(sql);
            const pgstream = client.query(copyToStream);
            pgstream
                .on('error', err => {
                    pgstream.unpipe(res);
                    done();
                    return cb(err);
                })
                .on('data', data => metrics.addSize(data.length))
                .on('end', () => {
                    metrics.end(copyToStream.rowCount);
                    done();
                    return cb(null, metrics);
                })
                .pipe(res);
        });
    },

    from (req, sql, userDbParams, gzip, logger, cb) {
        let metrics = new StreamCopyMetrics(logger, 'copyfrom', sql, gzip);
        
        const pg = new PSQL(userDbParams);
        pg.connect(function (err, client, done) {
            if (err) {
                return cb(err);
            }

            let copyFromStream = copyFrom(sql);
            const pgstream = client.query(copyFromStream);
            pgstream
                .on('error', err => {
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
                    req.unpipe(pgstream);
                    pgstream.end();
                    done();
                    return cb(err);
                })
                .on('close', () => {
                    if (!requestEnded) {
                        const connection = client.connection;
                        connection.sendCopyFail('CARTO SQL API: Connection closed by client');
                        req.unpipe(pgstream);
                        done();
                        return cb(new Error('Connection closed by client'));
                    }
                })
                .on('data', data => metrics.size += data.length)
                .on('end', () => requestEnded = true);

            if (gzip) {
                req.pipe(zlib.createGunzip()).pipe(pgstream);
            } else {
                req.pipe(pgstream);
            }
        });
    }
};
