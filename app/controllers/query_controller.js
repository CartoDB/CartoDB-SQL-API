'use strict';

var step = require('step');
var PSQL = require('cartodb-psql');
const QueryTables = require('cartodb-query-tables');
const pgEntitiesAccessValidator = require('../services/pg-entities-access-validator');
var queryMayWrite = require('../utils/query_may_write');
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
const handleQueryMiddleware = require('../middlewares/handle-query');
const parseQueryParams = require('../middlewares/query-params');
const logMiddleware = require('../middlewares/log');
const cancelOnClientAbort = require('../middlewares/cancel-on-client-abort');

const ONE_YEAR_IN_SECONDS = 31536000; // ttl in cache provider
const FIVE_MINUTES_IN_SECONDS = 60 * 5; // ttl in cache provider
const cacheControl = Object.assign({
    ttl: ONE_YEAR_IN_SECONDS,
    fallbackTtl: FIVE_MINUTES_IN_SECONDS
}, global.settings.cache);

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
            handleQueryMiddleware(),
            logMiddleware(logMiddleware.TYPES.QUERY),
            parseQueryParams(),
            cancelOnClientAbort(),
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

    const { user: username, userDbParams: dbopts, authDbParams, userLimits, authorizationLevel } = res.locals;
    const { orderBy, sortOrder, limit, offset } = res.locals.params;
    const { format, skipfields, decimalPrecision, filename, callback } = res.locals.params;

    let { sql } = res.locals;

    try {
        let formatter;

        if (req.profiler) {
            req.profiler.done('init');
        }

        // 1. Get the list of tables affected by the query
        // 2. Setup headers
        // 3. Send formatted results back
        // 4. Handle error
        step(
            function queryExplain() {
                var next = this;

                var pg = new PSQL(authDbParams);

                QueryTables.getAffectedTablesFromQuery(pg, sql, function (err, result) {
                    if (err) {
                        var errorMessage = (err && err.message) || 'unknown error';
                        console.error("Error on query explain '%s': %s", sql, errorMessage);
                    }
                    return next(null, result);
                });
            },
            function setHeaders(err, affectedTables) {
                if (err) {
                    throw err;
                }

                var mayWrite = queryMayWrite(sql);
                if ( req.profiler ) {
                    req.profiler.done('queryExplain');
                }

                if(!pgEntitiesAccessValidator.validate(affectedTables, authorizationLevel)) {
                    const syntaxError = new SyntaxError("system tables are forbidden");
                    syntaxError.http_status = 403;
                    throw(syntaxError);
                }

                var FormatClass = formats[format];
                formatter = new FormatClass();
                req.formatter = formatter;


                // configure headers for given format
                var useInline = (!req.query.format && !req.body.format && !req.query.filename && !req.body.filename);
                res.header("Content-Disposition", getContentDisposition(formatter, filename, useInline));
                res.header("Content-Type", formatter.getContentType());

                // set cache headers
                var cachePolicy = req.query.cache_policy;
                if (cachePolicy === 'persist') {
                    res.header('Cache-Control', 'public,max-age=' + ONE_YEAR_IN_SECONDS);
                } else {
                    if (affectedTables && affectedTables.getTables().every(table => table.updated_at !== null)) {
                        const maxAge = mayWrite ? 0 : cacheControl.ttl;
                        res.header('Cache-Control', `no-cache,max-age=${maxAge},must-revalidate,public`);
                    } else {
                        const maxAge = cacheControl.fallbackTtl;
                        res.header('Cache-Control', `no-cache,max-age=${maxAge},must-revalidate,public`);
                    }
                }

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

                // TODO: drop this, fix UI!
                sql = new PSQL.QueryWrapper(sql).orderBy(orderBy, sortOrder).window(limit, offset).query();

                var opts = {
                  username: username,
                  dbopts: dbopts,
                  sink: res,
                  gn: 'the_geom', // TODO: read from configuration FILE,
                  dp: decimalPrecision,
                  skipfields: skipfields,
                  sql: sql,
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
