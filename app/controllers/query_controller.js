'use strict';

var _ = require('underscore');
var step = require('step');
var assert = require('assert');
var PSQL = require('cartodb-psql');

var AuthApi = require('../auth/auth_api');

var CdbRequest = require('../models/cartodb_request');
var formats = require('../models/formats');

var sanitize_filename = require('../utils/filename_sanitizer');
var generateMD5 = require('../utils/md5');
var queryMayWrite = require('../utils/query_may_write');
var getContentDisposition = require('../utils/content_disposition');
var generateCacheKey = require('../utils/cache_key_generator');
var handleException = require('../utils/error_handler');

var cdbReq = new CdbRequest();

function QueryController(userDatabaseService, tableCache, statsd_client) {
    this.tableCache = tableCache;
    this.statsd_client = statsd_client;
    this.userDatabaseService = userDatabaseService;
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
    var tableCacheItem;

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

        // initialise MD5 key of sql for cache lookups
        var sql_md5 = generateMD5(sql);

        // placeholder for connection
        var pg;

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
                var next = this;
                var authApi = new AuthApi(req, params);

                self.userDatabaseService.getUserDatabase(authApi, cdbUsername, next);
            },
            function queryExplain(err, userDatabase){
                assert.ifError(err);

                var next = this;
                dbopts = userDatabase;

                if ( req.profiler ) {
                    req.profiler.done('setDBAuth');
                }

                checkAborted('queryExplain');

                pg = new PSQL(dbopts, {}, { destroyOnError: true });
                // get all the tables from Cache or SQL
                tableCacheItem = self.tableCache.get(sql_md5);
                if (tableCacheItem) {
                   tableCacheItem.hits++;
                   return false;
                } else {
                    var affectedTablesAndLastUpdatedTimeQuery = [
                        'WITH querytables AS (',
                            'SELECT * FROM CDB_QueryTablesText($quotesql$' + sql + '$quotesql$) as tablenames',
                        ')',
                        'SELECT (SELECT tablenames FROM querytables), EXTRACT(EPOCH FROM max(updated_at)) as max',
                        'FROM CDB_TableMetadata m',
                        'WHERE m.tabname = any ((SELECT tablenames from querytables)::regclass[])'
                    ].join(' ');

                    pg.query(affectedTablesAndLastUpdatedTimeQuery, function (err, resultSet) {
                        var tableNames = [];
                        var lastUpdatedTime = Date.now();

                        if (!err && resultSet.rowCount === 1) {
                            var result = resultSet.rows[0];
                            // This is an Array, so no need to split into parts
                            tableNames = result.tablenames;
                            if (Number.isFinite(result.max)) {
                                lastUpdatedTime = result.max * 1000;
                            }
                        } else {
                            var errorMessage = (err && err.message) || 'unknown error';
                            console.error("Error on query explain '%s': %s", sql, errorMessage);
                        }

                        return next(null, {
                            affectedTables: tableNames,
                            lastUpdatedTime: lastUpdatedTime
                        });
                    });
                }
            },
            function setHeaders(err, result) {
                assert.ifError(err);

                if ( req.profiler ) {
                    req.profiler.done('queryExplain');
                }

                checkAborted('setHeaders');

                // store explain result in local Cache
                if ( ! tableCacheItem && result && result.affectedTables ) {
                    tableCacheItem = {
                        affected_tables: result.affectedTables,
                        last_modified: result.lastUpdatedTime,
                        // check if query may possibly write
                        may_write: queryMayWrite(sql),
                        // initialise hit counter
                        hits: 1
                    };
                    self.tableCache.set(sql_md5, tableCacheItem);
                }

                if ( !dbopts.authenticated && tableCacheItem ) {
                    var affected_tables = tableCacheItem.affected_tables;
                    for ( var i = 0; i < affected_tables.length; ++i ) {
                        var t = affected_tables[i];
                        if ( t.match(/\bpg_/) ) {
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
                var ttl = 31536000; // 1 year time to live by default
                var cache_policy = req.query.cache_policy;
                if ( cache_policy === 'persist' ) {
                  res.header('Cache-Control', 'public,max-age=' + ttl);
                } else {
                  if ( ! tableCacheItem || tableCacheItem.may_write ) {
                    // Tell clients this response is already expired
                    // TODO: prevent cache_policy from overriding this ?
                    ttl = 0;
                  }
                  res.header('Cache-Control', 'no-cache,max-age='+ttl+',must-revalidate,public');
                }

                // Only set an X-Cache-Channel for responses we want Varnish to cache.
                if ( tableCacheItem && tableCacheItem.affected_tables.length > 0 && !tableCacheItem.may_write ) {
                  res.header('X-Cache-Channel', generateCacheKey(dbopts.dbname, tableCacheItem, dbopts.authenticated));
                }

                var lastModified = (tableCacheItem && tableCacheItem.last_modified) ?
                    tableCacheItem.last_modified :
                    Date.now();
                res.header('Last-Modified', new Date(lastModified).toUTCString());

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

                if (global.settings.api_hostname) {
                  res.header('X-Served-By-Host', global.settings.api_hostname);
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
                  req.profiler.sendStats(); // TODO: do on nextTick ?
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
