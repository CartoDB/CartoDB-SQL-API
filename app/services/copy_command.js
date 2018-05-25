const zlib = require('zlib');
const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;
const { getFormatFromCopyQuery } = require('../utils/query_info');

module.exports = {
    streamCopyTo (res, sql, userDbParams, cb) {
        let metrics = {
            type: 'copyto',
            size: 0, //bytes
            time: null, //seconds
            format: getFormatFromCopyQuery(sql),
            total_rows: null
        };

        const startTime = Date.now();

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
                .on('data', data => metrics.size += data.length)
                .on('end', () => {
                    metrics.time = (Date.now() - startTime) / 1000;
                    metrics.total_rows = copyToStream.rowCount;
                    return cb(null, metrics);
                })
                .pipe(res);
        });
    },

    streamCopyFrom (req, sql, userDbParams, isGziped, cb) {
        let metrics = {
            type: 'copyfrom',
            size: 0, //bytes
            time: null, //seconds
            format: getFormatFromCopyQuery(sql),
            total_rows: null, 
            gzip: isGziped
        }

        const startTime = Date.now();
        
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
                    metrics.time = (Date.now() - startTime) / 1000;
                    metrics.total_rows = copyFromStream.rowCount;

                    return cb(
                        null, 
                        {
                            time: metrics.time,
                            total_rows: copyFromStream.rowCount
                        },
                        metrics
                    );
                });

            let requestEnded = false;

            if (isGziped) {
                req = req.pipe(zlib.createGunzip());
            }

            req
                .on('error', err => {
                    req.unpipe(pgstream);
                    pgstream.end();
                    return cb(err);
                })
                .on('close', () => {
                    if (!requestEnded) {
                        req.unpipe(pgstream);
                        pgstream.end();
                        return cb(new Error('Connection closed by client'));
                    }
                })
                .on('data', data => metrics.size += data.length)
                .on('end', () => requestEnded = true)
                .pipe(pgstream);
        });
    }
}
