'use strict';

var _ = require('underscore');
var step = require('step');
var assert = require('assert');
var PSQL = require('cartodb-psql');
var CachedQueryTables = require('../services/cached-query-tables');
var AuthApi = require('../auth/auth_api');
var queryMayWrite = require('../utils/query_may_write');

var CdbRequest = require('../models/cartodb_request');
var formats = require('../models/formats');

var sanitize_filename = require('../utils/filename_sanitizer');
var getContentDisposition = require('../utils/content_disposition');
var handleException = require('../utils/error_handler');

var ONE_YEAR_IN_SECONDS = 31536000; // 1 year time to live by default

var cdbReq = new CdbRequest();

function QueryController(userDatabaseService, tableCache, statsd_client) {
    this.statsd_client = statsd_client;
    this.userDatabaseService = userDatabaseService;
    this.queryTables = new CachedQueryTables(tableCache);
}

QueryController.prototype.route = function (app) {
    app.all(global.settings.base_url + '/sql',  this.handleQuery.bind(this));
    app.all(global.settings.base_url + '/sql.:f',  this.handleQuery.bind(this));
};

// jshint maxcomplexity:21
QueryController.prototype.handleQuery = function (req, res) {
    var self = this;
    // extract input
    var body = (req.body) ? req.body : {};
    var params = _.extend({}, req.query, body); // clone so don't modify req.params or req.body so oauth is not broken
    var sql = params.q;
    var limit = parseInt(params.rows_per_page);
    var offset = parseInt(params.page);
    var orderBy = params.order_by;
    var sortOrder = params.sort_order;
    var requestedFormat = params.format;
    var format = _.isArray(requestedFormat) ? _.last(requestedFormat) : requestedFormat;
    var requestedFilename = params.filename;
    var filename = requestedFilename;
    var requestedSkipfields = params.skipfields;
    var cdbUsername = cdbReq.userByReq(req);
    var skipfields;
    var dp = params.dp; // decimal point digits (defaults to 6)
    var gn = "the_geom"; // TODO: read from configuration file

    if ( req.profiler ) {
        req.profiler.start('sqlapi.query');
    }

    req.aborted = false;
    req.on("close", function() {
        if (req.formatter && _.isFunction(req.formatter.cancel)) {
            req.formatter.cancel();
        }
        req.aborted = true; // TODO: there must be a builtin way to check this
    });

    function checkAborted(step) {
      if ( req.aborted ) {
        var err = new Error("Request aborted during " + step);
        // We'll use status 499, same as ngnix in these cases
        // see http://en.wikipedia.org/wiki/List_of_HTTP_status_codes#4xx_Client_Error
        err.http_status = 499;
        throw err;
      }
    }

    try {

        // sanitize and apply defaults to input
        dp        = (dp       === "" || _.isUndefined(dp))       ? '6'  : dp;
        format    = (format   === "" || _.isUndefined(format))   ? 'json' : format.toLowerCase();
        filename  = (filename === "" || _.isUndefined(filename)) ? 'cartodb-query' : sanitize_filename(filename);
        sql       = (sql      === "" || _.isUndefined(sql))      ? null : sql;
        limit     = (!_.isNaN(limit))  ? limit : null;
        offset    = (!_.isNaN(offset)) ? offset * limit : null;

        // Accept both comma-separated string or array of comma-separated strings
        if ( requestedSkipfields ) {
          if ( _.isString(requestedSkipfields) ) {
              skipfields = requestedSkipfields.split(',');
          } else if ( _.isArray(requestedSkipfields) ) {
            skipfields = [];
            _.each(requestedSkipfields, function(ele) {
              skipfields = skipfields.concat(ele.split(','));
            });
          }
        } else {
          skipfields = [];
        }

        //if ( -1 === supportedFormats.indexOf(format) )
        if ( ! formats.hasOwnProperty(format) ) {
            throw new Error("Invalid format: " + format);
        }

        if (!_.isString(sql)) {
            throw new Error("You must indicate a sql query");
        }

        // Database options
        var dbopts = {};
        var formatter;

        if ( req.profiler ) {
            req.profiler.done('init');
        }

        // 1. Get user database and related parameters
        // 3. Get the list of tables affected by the query
        // 4. Setup headers
        // 5. Send formatted results back
        step(
            function getUserDBInfo() {
                self.userDatabaseService.getConnectionParams(new AuthApi(req, params), cdbUsername, this);
            },
            function queryExplain(err, dbParams, authDbParams) {
                assert.ifError(err);

                var next = this;

                dbopts = dbParams;

                if ( req.profiler ) {
                    req.profiler.done('setDBAuth');
                }

                checkAborted('queryExplain');

                var pg = new PSQL(authDbParams, {}, { destroyOnError: true });
                var skipCache = !!dbopts.authenticated;

                self.queryTables.getAffectedTablesFromQuery(pg, sql, skipCache, function(err, result) {
                    if (err) {
                        var errorMessage = (err && err.message) || 'unknown error';
                        console.error("Error on query explain '%s': %s", sql, errorMessage);
                    }
                    return next(null, result);
                });
            },
            function setHeaders(err, affectedTables) {
                assert.ifError(err);

                var mayWrite = queryMayWrite(sql);
                if ( req.profiler ) {
                    req.profiler.done('queryExplain');
                }

                checkAborted('setHeaders');
                if (!dbopts.authenticated && !!affectedTables) {
                    for ( var i = 0; i < affectedTables.tables.length; ++i ) {
                        var t = affectedTables.tables[i];
                        if ( t.table_name.match(/\bpg_/) ) {
                            var e = new SyntaxError("system tables are forbidden");
                            e.http_status = 403;
                            throw(e);
                        }
                    }
                }

                var FormatClass = formats[format];
                formatter = new FormatClass();
                req.formatter = formatter;


                // configure headers for given format
                var use_inline = !requestedFormat && !requestedFilename;
                res.header("Content-Disposition", getContentDisposition(formatter, filename, use_inline));
                res.header("Content-Type", formatter.getContentType());

                // set cache headers
                var cachePolicy = req.query.cache_policy;
                if (cachePolicy === 'persist') {
                    res.header('Cache-Control', 'public,max-age=' + ONE_YEAR_IN_SECONDS);
                } else {
                    var maxAge = (mayWrite) ? 0 : ONE_YEAR_IN_SECONDS;
                    res.header('Cache-Control', 'no-cache,max-age='+maxAge+',must-revalidate,public');
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
                assert.ifError(err);
                checkAborted('generateFormat');

                // TODO: drop this, fix UI!
                sql = new PSQL.QueryWrapper(sql).orderBy(orderBy, sortOrder).window(limit, offset).query();

                var opts = {
                  username: cdbUsername,
                  dbopts: dbopts,
                  sink: res,
                  gn: gn,
                  dp: dp,
                  skipfields: skipfields,
                  sql: sql,
                  filename: filename,
                  bufferedRows: global.settings.bufferedRows,
                  callback: params.callback,
                  abortChecker: checkAborted
                };

                if ( req.profiler ) {
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

                if ( err ) {
                    handleException(err, res);
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
        handleException(err, res);

        if (self.statsd_client) {
            self.statsd_client.increment('sqlapi.query.error');
        }
    }

};

module.exports = QueryController;
