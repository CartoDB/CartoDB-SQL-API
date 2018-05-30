const zlib = require('zlib');
const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;
const StreamCopyMetrics = require('./stream_copy_metrics');

module.exports = {
    to (res, sql, userDbParams, logger, cb) {
        let metrics = new StreamCopyMetrics(logger, 'copyto', sql);

        const pg = new PSQL(userDbParams);
        pg.connect(function (err, client) {
            if (err) {
                return cb(err);
            }

            const copyToStream = copyTo(sql);
            const pgstream = client.query(copyToStream);
            pgstream
                .on('error', err => {
                    pgstream.unpipe(res);
                    return cb(err);
                })
                .on('data', data => metrics.addSize(data.length))
                .on('end', () => {
                    metrics.end(copyToStream.rowCount);
                    return cb(null, metrics);
                })
                .pipe(res);
        });
    },

    from (req, sql, userDbParams, gzip, logger, cb) {
        let metrics = new StreamCopyMetrics(logger, 'copyfrom', sql, gzip);
        
        const pg = new PSQL(userDbParams);
        pg.connect(function (err, client) {
            if (err) {
                return cb(err);
            }

            let copyFromStream = copyFrom(sql);
            const pgstream = client.query(copyFromStream);
            pgstream
                .on('error', err => {
                    req.unpipe(pgstream);
                    return cb(err); 
                })
                .on('end', function () {
                    metrics.end(copyFromStream.rowCount);
                    return cb(null, metrics);
                });

            let requestEnded = false;

            req
                .on('error', err => {
                    req.unpipe(pgstream);
                    pgstream.end();
                    return cb(err);
                })
                .on('close', () => {
                    if (!requestEnded) {
                        const connection = client.connection;
                        connection.sendCopyFail();
                        req.unpipe(pgstream);
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
