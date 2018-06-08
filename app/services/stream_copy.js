const zlib = require('zlib');
const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;
const StreamCopyMetrics = require('./stream_copy_metrics');
const { Client } = require('pg');
const Logger = require('./logger');

module.exports = {
    to() {
        
    },

    from(sql, userDbParams, cb, next) {
        const pg = new PSQL(userDbParams);
        pg.connect(function (err, client, done) {
            if (err) {
                cb(err);
            }

            let copyFromStream = copyFrom(sql);
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

            cb(null, pgstream, client, done)
        });
    }
};
