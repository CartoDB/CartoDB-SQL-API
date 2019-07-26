'use strict';

var step = require('step');
var PSQL = require('cartodb-psql');
const formats = require('../models/formats');
var getContentDisposition = require('../utils/content_disposition');
const bodyParserMiddleware = require('../middlewares/body-parser');
const userMiddleware = require('../middlewares/user');
const errorMiddleware = require('../middlewares/error');
const authorizationMiddleware = require('../middlewares/authorization');
const connectionParamsMiddleware = require('../middlewares/connection-params');
const timeoutLimitsMiddleware = require('../middlewares/timeout-limits');
const { initializeProfilerMiddleware } = require('../middlewares/profiler');
const rateLimitsMiddleware = require('../middlewares/rate-limit');
const { RATE_LIMIT_ENDPOINTS_GROUPS } = rateLimitsMiddleware;
const parameters = require('../middlewares/parameters');
const logMiddleware = require('../middlewares/log');
const cancelOnClientAbort = require('../middlewares/cancel-on-client-abort');
const affectedTables = require('../middlewares/affected-tables');
const accessValidator = require('../middlewares/access-validator');
const queryMayWrite = require('../middlewares/query-may-write');
const cacheControl = require('../middlewares/cache-control');

function QueryController(metadataBackend, userDatabaseService, statsd_client, userLimitsService) {
    this.metadataBackend = metadataBackend;
    this.statsd_client = statsd_client;
    this.userDatabaseService = userDatabaseService;
    this.userLimitsService = userLimitsService;
}

QueryController.prototype.route = function (app) {
    const { base_url } = global.settings;
    const forceToBeMaster = false;

    const queryMiddlewares = () => {
        return [
            bodyParserMiddleware(),
            initializeProfilerMiddleware('query'),
            userMiddleware(this.metadataBackend),
            rateLimitsMiddleware(this.userLimitsService, RATE_LIMIT_ENDPOINTS_GROUPS.QUERY),
            authorizationMiddleware(this.metadataBackend, forceToBeMaster),
            connectionParamsMiddleware(this.userDatabaseService),
            timeoutLimitsMiddleware(this.metadataBackend),
            parameters({ strategy: 'query' }),
            logMiddleware(logMiddleware.TYPES.QUERY),
            cancelOnClientAbort(),
            affectedTables(),
            accessValidator(),
            queryMayWrite(),
            cacheControl(),
            this.handleQuery.bind(this),
            errorMiddleware()
        ];
    };

    app.all(`${base_url}/sql`, queryMiddlewares());
    app.all(`${base_url}/sql.:f`, queryMiddlewares());
};

// jshint maxcomplexity:21
QueryController.prototype.handleQuery = function (req, res, next) {
    var self = this;

    const {
        user: username,
        userDbParams: dbopts,
        userLimits,
        affectedTables,
        mayWrite
    } = res.locals;
    const { orderBy, sortOrder, limit, offset } = res.locals.params;
    const { sql, format, skipfields, decimalPrecision, filename, callback } = res.locals.params;

    try {
        let formatter;

        if (req.profiler) {
            req.profiler.done('init');
        }

        // 1. Setup headers
        // 2. Send formatted results back
        // 3. Handle error
        step(
            function setHeaders() {
                var FormatClass = formats[format];
                formatter = new FormatClass();
                req.formatter = formatter;

                // configure headers for given format
                var useInline = (!req.query.format && !req.body.format && !req.query.filename && !req.body.filename);
                res.header("Content-Disposition", getContentDisposition(formatter, filename, useInline));
                res.header("Content-Type", formatter.getContentType());

                // Only set an X-Cache-Channel for responses we want Varnish to cache.
                var skipNotUpdatedAtTables = true;
                if (!!affectedTables && affectedTables.getTables(skipNotUpdatedAtTables).length > 0 && !mayWrite) {
                    res.header('X-Cache-Channel', affectedTables.getCacheChannel(skipNotUpdatedAtTables));
                    res.header('Surrogate-Key', affectedTables.key(skipNotUpdatedAtTables).join(' '));
                }

                if(!!affectedTables) {
                    res.header('Last-Modified',
                               new Date(affectedTables.getLastUpdatedAt(Number(new Date()))).toUTCString());
                }

                return null;
            },
            function generateFormat(err){
                if (err) {
                    throw err;
                }

                var opts = {
                  username: username,
                  dbopts: dbopts,
                  sink: res,
                  gn: 'the_geom', // TODO: read from configuration FILE,
                  dp: decimalPrecision,
                  skipfields: skipfields,
                  sql: new PSQL.QueryWrapper(sql).orderBy(orderBy, sortOrder).window(limit, offset).query(),
                  filename: filename,
                  bufferedRows: global.settings.bufferedRows,
                  callback: callback,
                  timeout: userLimits.timeout
                };

                if (req.profiler) {
                  opts.profiler = req.profiler;
                  opts.beforeSink = function() {
                    req.profiler.done('beforeSink');
                    res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
                  };
                }

                if (dbopts.host) {
                  res.header('X-Served-By-DB-Host', dbopts.host);
                }

                formatter.sendResponse(opts, this);
            },
            function errorHandle(err){
                formatter = null;

                if (err) {
                    next(err);
                }

                if ( req.profiler ) {
                    req.profiler.sendStats();
                }
                if (self.statsd_client) {
                  if ( err ) {
                      self.statsd_client.increment('sqlapi.query.error');
                  } else {
                      self.statsd_client.increment('sqlapi.query.success');
                  }
                }
            }
        );
    } catch (err) {
        next(err);

        if (self.statsd_client) {
            self.statsd_client.increment('sqlapi.query.error');
        }
    }

};

module.exports = QueryController;
