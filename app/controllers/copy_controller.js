'use strict';

var _ = require('underscore');

const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const timeoutLimitsMiddleware = require('../middlewares/timeout-limits');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;
const Busboy = require('busboy');

var PSQL = require('cartodb-psql');
var copyTo = require('pg-copy-streams').to;
var copyFrom = require('pg-copy-streams').from;


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

    var sql = req.query.sql;
    var filename = req.query.filename;
    sql = (sql === "" || _.isUndefined(sql)) ? null : sql;

    // Ensure SQL parameter is not missing
    if (!_.isString(sql)) {
        throw new Error("Parameter 'sql' is missing");
    }

    // Only accept SQL that starts with 'COPY'
    if (!sql.toUpperCase().startsWith("COPY ")) {
        throw new Error("SQL must start with COPY");
    }

    try {
        // Open pgsql COPY pipe and stream out to HTTP response
        var pg = new PSQL(res.locals.userDbParams);
        pg.connect(function (err, client, cb) {
            var copyToStream = copyTo(sql);
            var pgstream = client.query(copyToStream);
            res.on('error', next);
            pgstream.on('error', next);
            pgstream.on('end', cb);
            // User did not provide a preferred download filename
            if (!_.isString(filename)) {
                filename = 'carto-sql-copyto.dmp';
            }
            var contentDisposition = "attachment; filename=" + encodeURIComponent(filename);
            res.setHeader("Content-Disposition", contentDisposition);
            res.setHeader("Content-Type", "application/octet-stream");
            pgstream.pipe(res);
        });
    } catch (err) {
        next(err);
    }

};


CopyController.prototype.handleCopyFrom = function (req, res, next) {
    const busboy = new Busboy({ headers: req.headers });
    let sql = req.query.sql;
    let files = 0;
    
    busboy.on('field', function (fieldname, val) {
        if (fieldname === 'sql') {
            sql = val;
            
            // Only accept SQL that starts with 'COPY'
            if (!sql.toUpperCase().startsWith("COPY ")) {
                return next(new Error("SQL must start with COPY"));
            }
        }
    });

    busboy.on('file', function (fieldname, file) {
        files++;

        if (!sql) {
            return next(new Error("Parameter 'sql' is missing, must be in URL or first field in POST"));
        }
        
        try {
            const start_time = Date.now();
            
            // Connect and run the COPY
            const pg = new PSQL(res.locals.userDbParams);
            pg.connect(function(err, client) {
                if (err) {
                    return next(err);
                }
    
                let copyFromStream = copyFrom(sql);
                const pgstream = client.query(copyFromStream);
                pgstream.on('error', next);
                pgstream.on('end', function () {
                    var end_time = Date.now();
                    res.body = {
                        time: (end_time - start_time)/1000,
                        total_rows: copyFromStream.rowCount
                    };

                    return next();
                });

                file.pipe(pgstream);
            });
    
        } catch (err) {
            next(err);
        }
    });

    busboy.on('finish', () => {
        if(files !== 1) {
            return next(new Error("The file is missing"));
        }
    });

    busboy.on('error', next);

    req.pipe(busboy);
};

CopyController.prototype.responseCopyFrom = function (req, res, next) {
    if (!res.body || !res.body.total_rows) {
        return next(new Error("No rows copied"));
    }

    res.send(res.body);
};

module.exports = CopyController;
