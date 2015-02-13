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

if ( ! process.env['PGAPPNAME'] )
  process.env['PGAPPNAME']='cartodb_sqlapi';

function App() {

var path = require('path');

var express = require('express')
    , app      = express.createServer()
    , Step        = require('step')
    , crypto      = require('crypto')
    , fs          = require('fs')
    , os          = require('os')
    , zlib        = require('zlib')
    , util        = require('util')
    , Profiler    = require('step-profiler')
    , PSQL        = require('cartodb-psql')
    , CdbRequest  = require(global.settings.app_root + '/app/models/cartodb_request')
    , AuthApi     = require(global.settings.app_root + '/app/auth/auth_api')
    , _           = require('underscore')
    , LRU         = require('lru-cache')
    , formats     = require(global.settings.app_root + '/app/models/formats')
    , HealthCheck = require(global.settings.app_root + '/app/monitoring/health_check')
    , PgErrorHandler = require(global.settings.app_root + '/app/postgresql/error_handler')
    ;

var cdbReq = new CdbRequest();

// Set default configuration 
global.settings.db_pubuser = global.settings.db_pubuser || "publicuser";
global.settings.bufferedRows = global.settings.bufferedRows || 1000;

var tableCache = LRU({
  // store no more than these many items in the cache
  max: global.settings.tableCacheMax || 8192,
  // consider entries expired after these many milliseconds (10 minutes by default)
  maxAge: global.settings.tableCacheMaxAge || 1000*60*10
});

function pad(n) { return n < 10 ? '0' + n : n }
Date.prototype.toJSON = function() {
  var s = this.getFullYear() + '-'
      + pad(this.getMonth() + 1) + '-'
      + pad(this.getDate()) + 'T'
      + pad(this.getHours()) + ':'
      + pad(this.getMinutes()) + ':'
      + pad(this.getSeconds());
  var offset = this.getTimezoneOffset();
  if (offset == 0) s += 'Z';
  else {
    s += ( offset < 0 ? '+' : '-' )
      + pad(Math.abs(offset / 60))
      + pad(Math.abs(offset % 60))

  }
  return s;
};

var loggerOpts = {
    buffer: true,
    format: global.settings.log_format ||
            ':req[X-Real-IP] :method :req[Host]:url :status :response-time ms -> :res[Content-Type]'
};

if ( global.log4js ) {
  app.use(log4js.connectLogger(log4js.getLogger(), _.defaults(loggerOpts, {level:'info'})));
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
    if ( this_msg != last_msg ) {
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
    next()
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
app.all(global.settings.base_url+'/sql',     function(req, res) { handleQuery(req, res) } );
app.all(global.settings.base_url+'/sql.:f',  function(req, res) { handleQuery(req, res) } );
app.get(global.settings.base_url+'/cachestatus',  function(req, res) { handleCacheStatus(req, res) } );
app.get(global.settings.base_url+'/health',  function(req, res) { handleHealthCheck(req, res) } );
app.get(global.settings.base_url+'/version', function(req, res) {
  res.send(getVersion());
});

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
function handleQuery(req, res) {

    // extract input
    var body      = (req.body) ? req.body : {};
    var params    = _.extend({}, req.query, body); // clone so don't modify req.params or req.body so oauth is not broken
    var sql       = params.q;
    var limit     = parseInt(params.rows_per_page);
    var offset    = parseInt(params.page);
    var orderBy   = params.order_by;
    var sortOrder = params.sort_order;
    var requestedFormat = params.format;
    var format    = _.isArray(requestedFormat) ? _.last(requestedFormat) : requestedFormat;
    var requestedFilename = params.filename;
    var filename  = requestedFilename;
    var requestedSkipfields = params.skipfields;
    var skipfields;
    var dp        = params.dp; // decimal point digits (defaults to 6)
    var gn        = "geom"; // TODO: read from configuration file
    var tableCacheItem;

    if ( req.profiler ) req.profiler.start('sqlapi.query');

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
          if ( _.isString(requestedSkipfields) ) skipfields = requestedSkipfields.split(',');
          else if ( _.isArray(requestedSkipfields) ) {
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

        var authenticated = true;

        var formatter;

        var cdbUsername = cdbReq.userByReq(req),
            authApi = new AuthApi(req, params),
            dbParams;

        if ( req.profiler ) req.profiler.done('init');

        // 1. Get database from redis via the username stored in the host header subdomain
        // 2. Run the request through OAuth to get R/W user id if signed
        // 3. Get the list of tables affected by the query
        // 4. Setup headers
        // 5. Send formatted results back
        Step(
            function authenticate(err, userDBParams) {
                if (err) {
                    err.http_status = 404;
                    err.message = "Sorry, we can't find CartoDB user '" + cdbUsername
                        + "'. Please check that you have entered the correct domain.";
                    throw err;
                }

                if ( req.profiler ) req.profiler.done('getDBParams');

                dbParams = userDBParams;

                dbopts.host = global.settings.db_host;
                dbopts.dbname = global.settings.db_base_name;
                dbopts.user = global.settings.db_pubuser;
                return null;
            },
            function setDBAuth(err, isAuthenticated) {
                if (err) {
                    throw err;
                }

                dbopts.user = global.settings.db_user;
                dbopts.pass = global.settings.db_user_pass;
                return null;
            },
            function queryExplain(err){
                var self = this;
                if (err) throw err;

                checkAborted('queryExplain');

                pg = new PSQL(dbopts);
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
                        console.error("Unexpected result from CDB_QueryTables($quotesql$" + sql + "$quotesql$): " + result);
                        self(null, []);
                      }
                   });
                }
            },
            function setHeaders(err, tables){
                if (err) throw err;

                if ( req.profiler ) req.profiler.done('queryExplain');

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

                var fClass = formats[format];
                formatter = new fClass();
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
                if (err) throw err;
                checkAborted('generateFormat');

                // TODO: drop this, fix UI!
                sql = new PSQL.QueryWrapper(sql).orderBy(orderBy, sortOrder).window(limit, offset).query();

                var opts = {
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

                if ( err ) handleException(err, res);
                if ( req.profiler ) {
                  req.profiler.sendStats(); // TODO: do on nextTick ?
                }
                if (statsd_client) {
                  if ( err ) statsd_client.increment('sqlapi.query.error');
                  else statsd_client.increment('sqlapi.query.success');
                }
            }
        );
    } catch (err) {
        handleException(err, res);
        if (statsd_client) statsd_client.increment('sqlapi.query.error');
    }
}

function handleCacheStatus(req, res){
    var tableCacheValues = tableCache.values();
    var totalExplainHits = _.reduce(tableCacheValues, function(memo, res) { return memo + res.hits}, 0);
    var totalExplainKeys = tableCacheValues.length;
    res.send({explain: {pid: process.pid, hits: totalExplainHits, keys : totalExplainKeys }});
}

var healthCheck = new HealthCheck(PSQL);
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
    return ( inline ? 'inline' : 'attachment' ) +'; filename=' + filename + '.' + ext + '; modification-date="' + time + '";';
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

    if (global.settings.environment == 'development') {
        msg.stack = err.stack;
    }

    if (global.settings.environment !== 'test'){
        // TODO: email this Exception report
        console.error("EXCEPTION REPORT: " + err.stack)
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
