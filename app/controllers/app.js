// CartoDB SQL API
//
// all requests expect the following URL args:
// - `sql` {String} SQL to execute
//
// for private (read/write) queries:
// - OAuth. Must have proper OAuth 1.1 headers. For OAuth 1.1 spec see Google
//
// eg. /api/v1/?sql=SELECT 1 as one (with a load of OAuth headers or URL arguments)
//
// for public (read only) queries:
// - sql only, provided the subdomain exists in CartoDB and the table's sharing options are public
//
// eg. vizzuality.cartodb.com/api/v1/?sql=SELECT * from my_table
//
//
var express = require('express');
var path = require('path');
var step = require('step');
var crypto = require('crypto');
var os = require('os');
var Profiler = require('step-profiler');
var StatsD = require('node-statsd').StatsD;
var PSQL = require('cartodb-psql');
var _ = require('underscore');
var LRU = require('lru-cache');
var assert = require('assert');

var CdbRequest = require('../models/cartodb_request');
var AuthApi = require('../auth/auth_api');
var formats = require('../models/formats');
var HealthCheck = require('../monitoring/health_check');
var PgErrorHandler = require('../postgresql/error_handler');

process.env.PGAPPNAME = process.env.PGAPPNAME || 'cartodb_sqlapi';

// jshint ignore:start
function pad(n) { return n < 10 ? '0' + n : n; }
Date.prototype.toJSON = function() {
    var s = this.getFullYear() + '-' + pad(this.getMonth() + 1) + '-' + pad(this.getDate()) + 'T' +
        pad(this.getHours()) + ':' + pad(this.getMinutes()) + ':' + pad(this.getSeconds());
    var offset = this.getTimezoneOffset();
    if (offset === 0) {
        s += 'Z';
    } else {
        s += ( offset < 0 ? '+' : '-' ) + pad(Math.abs(offset / 60)) + pad(Math.abs(offset % 60));
    }
    return s;
};
// jshint ignore:end

// jshint maxcomplexity:21
function App() {

var app = express.createServer();

var metadataBackend = require('cartodb-redis')({
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
});
var cdbReq = new CdbRequest();

// Set default configuration 
global.settings.db_pubuser = global.settings.db_pubuser || "publicuser";
global.settings.bufferedRows = global.settings.bufferedRows || 1000;
global.settings.db_pool_destroy_client_on_error = global.settings.hasOwnProperty('db_pool_destroy_client_on_error') ?
    global.settings.db_pool_destroy_client_on_error : true;

var tableCache = LRU({
  // store no more than these many items in the cache
  max: global.settings.tableCacheMax || 8192,
  // consider entries expired after these many milliseconds (10 minutes by default)
  maxAge: global.settings.tableCacheMaxAge || 1000*60*10
});

var loggerOpts = {
    buffer: true,
    format: global.settings.log_format ||
            ':remote-addr :method :req[Host]:url :status :response-time ms -> :res[Content-Type]'
};

if ( global.log4js ) {
  app.use(global.log4js.connectLogger(global.log4js.getLogger(), _.defaults(loggerOpts, {level:'info'})));
} else {
  app.use(express.logger(loggerOpts));
}

// Initialize statsD client if requested
var statsd_client;
if ( global.settings.statsd ) {

  // Perform keyword substitution in statsd
  if ( global.settings.statsd.prefix ) {
    var host_token = os.hostname().split('.').reverse().join('.');
    global.settings.statsd.prefix = global.settings.statsd.prefix.replace(/:host/, host_token);
  }

  statsd_client = new StatsD(global.settings.statsd);
  statsd_client.last_error = { msg:'', count:0 };
  statsd_client.socket.on('error', function(err) {
    var last_err = statsd_client.last_error;
    var last_msg = last_err.msg;
    var this_msg = ''+err;
    if ( this_msg !== last_msg ) {
      console.error("statsd client socket error: " + err);
      statsd_client.last_error.count = 1;
      statsd_client.last_error.msg = this_msg;
    } else {
        ++last_err.count;
        if ( ! last_err.interval ) {
          //console.log("Installing interval");
          statsd_client.last_error.interval = setInterval(function() {
            var count = statsd_client.last_error.count;
            if ( count > 1 ) {
              console.error("last statsd client socket error repeated " + count + " times");
              statsd_client.last_error.count = 1;
              //console.log("Clearing interval");
              clearInterval(statsd_client.last_error.interval);
              statsd_client.last_error.interval = null;
            }
          }, 1000);
        }
    }
  });
}


// Use step-profiler
if ( global.settings.useProfiler ) {
  app.use(function(req, res, next) {
    req.profiler = new Profiler({statsd_client:statsd_client});
    next();
  });
}

// Set connection timeout
if ( global.settings.hasOwnProperty('node_socket_timeout') ) {
  var timeout = parseInt(global.settings.node_socket_timeout);
  app.use(function(req, res, next) {
    req.connection.setTimeout(timeout);
    next();
  });
}

// Version extracting function
function getVersion() {
  var version = {};
  version.cartodb_sql_api = require(__dirname + '/../../package.json').version;
  return version;
}

app.use(express.bodyParser());
app.enable('jsonp callback');
app.set("trust proxy", true);

// basic routing
app.options('*', function(req,res) { setCrossDomain(res); res.end(); });

app.all(global.settings.base_url + '/sql',  handleQuery);
app.all(global.settings.base_url + '/sql.:f',  handleQuery);
app.get(global.settings.base_url + '/cachestatus', handleCacheStatus);
app.get(global.settings.base_url + '/health',  handleHealthCheck);
app.get(global.settings.base_url + '/version', handleVersion);

var sqlQueryMayWriteRegex = new RegExp("\\b(alter|insert|update|delete|create|drop|reindex|truncate|refresh)\\b", "i");
/**
 * This is a fuzzy check, the return could be true even if the query doesn't really write anything. But you can be
 * pretty sure of a false return.
 *
 * @param sql The SQL statement to check against
 * @returns {boolean} Return true of the given query may write to the database
 */
function queryMayWrite(sql) {
    return sqlQueryMayWriteRegex.test(sql);
}

function sanitize_filename(filename) {
  filename = path.basename(filename, path.extname(filename));
  filename = filename.replace(/[;()\[\]<>'"\s]/g, '_');
  //console.log("Sanitized: " + filename);
  return filename;
}

// request handlers
function handleVersion(req, res) {
  res.send(getVersion());
}

function handleQuery(req, res) {

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
        var dbopts = {
          port: global.settings.db_port,
          pass: global.settings.db_pubuser_pass
        };

        var authenticated = false;

        var formatter;

        var authApi = new AuthApi(req, params),
            dbParams;

        if ( req.profiler ) {
            req.profiler.done('init');
        }

        // 1. Get database from redis via the username stored in the host header subdomain
        // 2. Run the request through OAuth to get R/W user id if signed
        // 3. Get the list of tables affected by the query
        // 4. Setup headers
        // 5. Send formatted results back
        step(
            function getDatabaseConnectionParams() {
                checkAborted('getDatabaseConnectionParams');
                // If the request is providing credentials it may require every DB parameters
                if (authApi.hasCredentials()) {
                    metadataBackend.getAllUserDBParams(cdbUsername, this);
                } else {
                    metadataBackend.getUserDBPublicConnectionParams(cdbUsername, this);
                }
            },
            function authenticate(err, userDBParams) {
                if (err) {
                    err.http_status = 404;
                    err.message = "Sorry, we can't find CartoDB user '" + cdbUsername + "'. " +
                        "Please check that you have entered the correct domain.";
                    throw err;
                }

                if ( req.profiler ) {
                    req.profiler.done('getDBParams');
                }

                dbParams = userDBParams;

                dbopts.host = dbParams.dbhost;
                dbopts.dbname = dbParams.dbname;
                dbopts.user = (!!dbParams.dbpublicuser) ? dbParams.dbpublicuser : global.settings.db_pubuser;

                authApi.verifyCredentials({
                    metadataBackend: metadataBackend,
                    apiKey: dbParams.apikey
                }, this);
            },
            function setDBAuth(err, isAuthenticated) {
                if (err) {
                    throw err;
                }

                if ( req.profiler ) {
                    req.profiler.done('authenticate');
                }

                if (_.isBoolean(isAuthenticated) && isAuthenticated) {
                    authenticated = isAuthenticated;
                    dbopts.user = _.template(global.settings.db_user, {user_id: dbParams.dbuser});
                    if ( global.settings.hasOwnProperty('db_user_pass') ) {
                        dbopts.pass = _.template(global.settings.db_user_pass, {
                            user_id: dbParams.dbuser,
                            user_password: dbParams.dbpass
                        });
                    } else {
                        delete dbopts.pass;
                    }
                }
                return null;
            },
            function queryExplain(err){
                var self = this;

                assert.ifError(err);

                if ( req.profiler ) {
                    req.profiler.done('setDBAuth');
                }

                checkAborted('queryExplain');

                pg = new PSQL(dbopts, {}, { destroyOnError: global.settings.db_pool_destroy_client_on_error });
                // get all the tables from Cache or SQL
                tableCacheItem = tableCache.get(sql_md5);
                if (tableCacheItem) {
                   tableCacheItem.hits++;
                   return false;
                } else {
                   //TODO: sanitize cdbuser
                   pg.query("SELECT CDB_QueryTables($quotesql$" + sql + "$quotesql$)", function (err, result) {
                      if (err) {
                        self(err);
                        return;
                      }
                      if ( result.rowCount === 1 ) {
                        var raw_tables = result.rows[0].cdb_querytables;
                        var tables = raw_tables.split(/^\{(.*)\}$/)[1].split(',');
                        self(null, tables);
                      } else {
                        console.error(
                            "Unexpected result from CDB_QueryTables($quotesql$" + sql + "$quotesql$): " + result
                        );
                        self(null, []);
                      }
                   });
                }
            },
            function setHeaders(err, tables){
                assert.ifError(err);

                if ( req.profiler ) {
                    req.profiler.done('queryExplain');
                }

                checkAborted('setHeaders');

                // store explain result in local Cache
                if ( ! tableCacheItem && tables.length ) {
                    tableCacheItem = {
                      affected_tables: tables,
                      // check if query may possibly write
                      may_write: queryMayWrite(sql),
                      // initialise hit counter
                      hits: 1
                    };
                    tableCache.set(sql_md5, tableCacheItem);
                }

                if ( !authenticated && tableCacheItem ) {
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

                // allow cross site post
                setCrossDomain(res);

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
                if ( tableCacheItem && ! tableCacheItem.may_write ) {
                  res.header('X-Cache-Channel', generateCacheKey(dbopts.dbname, tableCacheItem, authenticated));
                }

                // Set Last-Modified header
                //
                // Currently sets it to NOW
                //
                // TODO: use a real value, querying for most recent change in
                //       any of the source tables
                //
                res.header('Last-Modified', new Date().toUTCString());

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
                if (statsd_client) {
                  if ( err ) {
                      statsd_client.increment('sqlapi.query.error');
                  } else {
                      statsd_client.increment('sqlapi.query.success');
                  }
                }
            }
        );
    } catch (err) {
        handleException(err, res);
        if (statsd_client) {
            statsd_client.increment('sqlapi.query.error');
        }
    }
}

function handleCacheStatus(req, res){
    var tableCacheValues = tableCache.values();
    var totalExplainHits = _.reduce(tableCacheValues, function(memo, res) { return memo + res.hits; }, 0);
    var totalExplainKeys = tableCacheValues.length;
    res.send({explain: {pid: process.pid, hits: totalExplainHits, keys : totalExplainKeys }});
}

var healthCheck = new HealthCheck(metadataBackend, PSQL);
function handleHealthCheck(req, res) {
    var healthConfig = global.settings.health || {};
    if (!!healthConfig.enabled) {
        var startTime = Date.now();
        healthCheck.check(healthConfig.username, healthConfig.query, function(err, result) {
            var ok = !err;
            var response = {
                enabled: true,
                ok: ok,
                elapsed: Date.now() - startTime,
                result: result
            };
            if (err) {
                response.err = err.message;
            }
            res.send(response, ok ? 200 : 503);

        });
    } else {
        res.send({enabled: false, ok: true}, 200);
    }
}

function getContentDisposition(formatter, filename, inline) {
    var ext = formatter.getFileExtension();
    var time = new Date().toUTCString();
    return ( inline ? 'inline' : 'attachment' ) + '; filename=' + filename + '.' + ext + '; ' +
        'modification-date="' + time + '";';
}

function setCrossDomain(res){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, X-Prototype-Version, X-CSRF-Token");
}

function generateCacheKey(database, query_info, is_authenticated){
    if ( ! query_info || ( is_authenticated && query_info.may_write ) ) {
      return "NONE";
    } else {
      return database + ":" + query_info.affected_tables.join(',');
    }
}

function generateMD5(data){
    var hash = crypto.createHash('md5');
    hash.update(data);
    return hash.digest('hex');
}


function handleException(err, res) {
    var pgErrorHandler = new PgErrorHandler(err);

    var msg = {
        error: [pgErrorHandler.getMessage()]
    };

    _.defaults(msg, pgErrorHandler.getFields());

    if (global.settings.environment === 'development') {
        msg.stack = err.stack;
    }

    if (global.settings.environment !== 'test'){
        // TODO: email this Exception report
        console.error("EXCEPTION REPORT: " + err.stack);
    }

    // allow cross site post
    setCrossDomain(res);

    // Force inline content disposition
    res.header("Content-Disposition", 'inline');

    if ( res.req && res.req.profiler ) {
      res.req.profiler.done('finish');
      res.header('X-SQLAPI-Profiler', res.req.profiler.toJSONString());
    }

    res.send(msg, getStatusError(pgErrorHandler, res.req));

    if ( res.req && res.req.profiler ) {
      res.req.profiler.sendStats();
    }
}

function getStatusError(pgErrorHandler, req) {

    var statusError = pgErrorHandler.getStatus();

    // JSONP has to return 200 status error
    if (req && req.query && req.query.callback) {
        statusError = 200;
    }

    return statusError;
}

return app;

}

module.exports = App;
