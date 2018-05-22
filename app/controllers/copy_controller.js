'use strict';

const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const timeoutLimitsMiddleware = require('../middlewares/timeout-limits');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;
const { getFormatFromCopyQuery } = require('../utils/query_info');

const zlib = require('zlib');
const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;


function CopyController(metadataBackend, userDatabaseService, userLimitsService, statsClient) {
    this.metadataBackend = metadataBackend;
    this.userDatabaseService = userDatabaseService;
    this.userLimitsService = userLimitsService;
    this.statsClient = statsClient;
}

CopyController.prototype.route = function (app) {
    const { base_url } = global.settings;

    const copyFromMiddlewares = endpointGroup => {
        return [
            initializeProfilerMiddleware('copyfrom'),
            userMiddleware(),
            rateLimitsMiddleware(this.userLimitsService, endpointGroup),
            authorizationMiddleware(this.metadataBackend),
            connectionParamsMiddleware(this.userDatabaseService),
            timeoutLimitsMiddleware(this.metadataBackend),
            validateCopyQuery(),
            handleCopyFrom(),
            responseCopyFrom(this.statsClient),
            errorMiddleware()
        ];
    };

    const copyToMiddlewares = endpointGroup => {
        return [
            initializeProfilerMiddleware('copyto'),
            userMiddleware(),
            rateLimitsMiddleware(this.userLimitsService, endpointGroup),
            authorizationMiddleware(this.metadataBackend),
            connectionParamsMiddleware(this.userDatabaseService),
            timeoutLimitsMiddleware(this.metadataBackend),
            validateCopyQuery(),
            handleCopyTo(this.statsClient),
            errorMiddleware()
        ];
    };

    app.post(`${base_url}/sql/copyfrom`, copyFromMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_FROM));
    app.get(`${base_url}/sql/copyto`, copyToMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_TO));
};


function handleCopyTo (statsClient) {
    return function handleCopyToMiddleware (req, res, next) {
        const sql = req.query.q;
        const filename = req.query.filename || 'carto-sql-copyto.dmp';

        let metrics = {
            size: 0,
            time: null,
            format: getFormatFromCopyQuery(sql),
            total_rows: null
        };

        res.header("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
        res.header("Content-Type", "application/octet-stream");

        try {
            const startTime = Date.now();

            // Open pgsql COPY pipe and stream out to HTTP response
            const pg = new PSQL(res.locals.userDbParams);
            pg.connect(function (err, client) {
                if (err) {
                    return next(err);
                }

                const copyToStream = copyTo(sql);
                const pgstream = client.query(copyToStream);
                pgstream
                    .on('error', next)
                    .on('data', data => metrics.size += data.length)
                    .on('end', () => {
                        metrics.time = (Date.now() - startTime) / 1000;
                        metrics.total_rows = copyToStream.rowCount;
                        statsClient.set('copyTo', JSON.stringify(metrics));
                    })
                    .pipe(res);
            });
        } catch (err) {
            next(err);
        }
    };
}

function handleCopyFrom () {
    return function handleCopyFromMiddleware (req, res, next) {
        const sql = req.query.q;

        res.locals.copyFromSize = 0;

        try {
            const startTime = Date.now();

            // Connect and run the COPY
            const pg = new PSQL(res.locals.userDbParams);
            pg.connect(function (err, client) {
                if (err) {
                    return next(err);
                }

                let copyFromStream = copyFrom(sql);
                const pgstream = client.query(copyFromStream);
                pgstream
                    .on('error', next)
                    .on('end', function () {
                        res.body = {
                            time: (Date.now() - startTime) / 1000,
                            total_rows: copyFromStream.rowCount
                        };

                        return next();
                    });

                if (req.get('content-encoding') === 'gzip') {
                    req
                        .pipe(zlib.createGunzip())
                        .on('data', data => res.locals.copyFromSize += data.length)
                        .pipe(pgstream);
                } else {
                    req
                        .on('data', data => res.locals.copyFromSize += data.length)
                        .pipe(pgstream);
                }
            });

        } catch (err) {
            next(err);
        }
    };
}

function responseCopyFrom (statsClient) {
    return function responseCopyFromMiddleware (req, res, next) {
        if (!res.body || !res.body.total_rows) {
            return next(new Error("No rows copied"));
        }

        const metrics = {
            size: res.locals.copyFromSize, //bytes
            format: getFormatFromCopyQuery(req.query.q),
            time: res.body.time, //seconds
            total_rows: res.body.total_rows, 
            gzip: req.get('content-encoding') === 'gzip'
        };

        statsClient.set('copyFrom', JSON.stringify(metrics));
        
        res.send(res.body);
    };
}

function validateCopyQuery () {
    return function validateCopyQueryMiddleware (req, res, next) {
        const sql = req.query.q;

        if (!sql) {
            next(new Error("SQL is missing"));
        }

        // Only accept SQL that starts with 'COPY'
        if (!sql.toUpperCase().startsWith("COPY ")) {
            next(new Error("SQL must start with COPY"));
        }

        next();
    };
}


module.exports = CopyController;
