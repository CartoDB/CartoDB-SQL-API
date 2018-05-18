'use strict';

const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const timeoutLimitsMiddleware = require('../middlewares/timeout-limits');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;

const zlib = require('zlib');
const PSQL = require('cartodb-psql');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;


function CopyController(metadataBackend, userDatabaseService, userLimitsService) {
    this.metadataBackend = metadataBackend;
    this.userDatabaseService = userDatabaseService;
    this.userLimitsService = userLimitsService;
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
            this.handleCopyFrom.bind(this),
            this.responseCopyFrom.bind(this),
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
            this.handleCopyTo.bind(this),
            errorMiddleware()
        ];
    };

    app.post(`${base_url}/sql/copyfrom`, copyFromMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_FROM));
    app.get(`${base_url}/sql/copyto`, copyToMiddlewares(RATE_LIMIT_ENDPOINTS_GROUPS.COPY_TO));
};

CopyController.prototype.handleCopyTo = function (req, res, next) {
    const { sql } = req.query;
    const filename = req.query.filename || 'carto-sql-copyto.dmp';

    if (!sql) {
        throw new Error("Parameter 'sql' is missing");
    }

    // Only accept SQL that starts with 'COPY'
    if (!sql.toUpperCase().startsWith("COPY ")) {
        throw new Error("SQL must start with COPY");
    }

    try {
        // Open pgsql COPY pipe and stream out to HTTP response
        const pg = new PSQL(res.locals.userDbParams);
        pg.connect(function (err, client) {
            if (err) {
                return next(err);
            }

            let copyToStream = copyTo(sql);
            const pgstream = client.query(copyToStream);

            res.on('error', next);
            pgstream.on('error', next);
            pgstream.on('end', next);

            res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(filename)}`);
            res.setHeader("Content-Type", "application/octet-stream");

            pgstream.pipe(res);
        });
    } catch (err) {
        next(err);
    }

};

CopyController.prototype.handleCopyFrom = function (req, res, next) {
    const { sql } = req.query;

    if (!sql) {
        return next(new Error("Parameter 'sql' is missing, must be in URL or first field in POST"));
    }

    // Only accept SQL that starts with 'COPY'
    if (!sql.toUpperCase().startsWith("COPY ")) {
        return next(new Error("SQL must start with COPY"));
    }

    res.locals.copyFromSize = 0;

    try {
        const start_time = Date.now();

        // Connect and run the COPY
        const pg = new PSQL(res.locals.userDbParams);
        pg.connect(function (err, client) {
            if (err) {
                return next(err);
            }

            let copyFromStream = copyFrom(sql);
            const pgstream = client.query(copyFromStream);
            pgstream.on('error', next);
            pgstream.on('end', function () {
                const end_time = Date.now();
                res.body = {
                    time: (end_time - start_time) / 1000,
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

CopyController.prototype.responseCopyFrom = function (req, res, next) {
    if (!res.body || !res.body.total_rows) {
        return next(new Error("No rows copied"));
    }

    if (req.profiler) {
        const copyFromMetrics = {
            time: res.body.time, //seconds
            size: res.locals.copyFromSize, //bytes
            total_rows: res.body.total_rows, 
            gzip: req.get('content-encoding') === 'gzip'
        };

        req.profiler.add({ copyFrom: copyFromMetrics });
        res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());+
    }

    res.send(res.body);
};

module.exports = CopyController;
