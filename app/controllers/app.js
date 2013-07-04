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

var path = require('path');

var express = require('express')
    , app      = express.createServer(
    express.logger({
        buffer: true,
        format: '[:date] :req[X-Real-IP] \033[90m:method\033[0m \033[36m:req[Host]:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m'
    }))
    , Step        = require('step')
    , crypto      = require('crypto')
    , fs          = require('fs')
    , zlib        = require('zlib')
    , util        = require('util')
    , spawn       = require('child_process').spawn
    , Meta        = require(global.settings.app_root + '/app/models/metadata')
    , oAuth       = require(global.settings.app_root + '/app/models/oauth')
    , PSQL        = require(global.settings.app_root + '/app/models/psql')
    , ApiKeyAuth  = require(global.settings.app_root + '/app/models/apikey_auth')
    , _           = require('underscore')
    , LRU         = require('lru-cache')
    , formats     = require(global.settings.app_root + '/app/models/formats')
    ;

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
}

app.use(express.bodyParser());
app.enable('jsonp callback');
app.set("trust proxy", true);

// basic routing
app.options('*', function(req,res) { setCrossDomain(res); res.end(); });
app.all(global.settings.base_url+'/sql',     function(req, res) { handleQuery(req, res) } );
app.all(global.settings.base_url+'/sql.:f',  function(req, res) { handleQuery(req, res) } );
app.get(global.settings.base_url+'/cachestatus',  function(req, res) { handleCacheStatus(req, res) } );

// Return true of the given query may write to the database
//
// NOTE: this is a fuzzy check, the return could be true even
//       if the query doesn't really write anything.
//       But you can be pretty sure of a false return.
//
function queryMayWrite(sql) {
  var mayWrite = false;
  var pattern = RegExp("(alter|insert|update|delete|create|drop|truncate)", "i");
  if ( pattern.test(sql) ) {
    mayWrite = true;
  }
  return mayWrite;
}

function sanitize_filename(filename) {
  filename = path.basename(filename, path.extname(filename));
  filename = filename.replace(/[;()\[\]<>'"\s]/g, '_');
  //console.log("Sanitized: " + filename);
  return filename;
}

// request handlers
function handleQuery(req, res) {

    //var supportedFormats = ['json', 'geojson', 'topojson', 'csv', 'svg', 'shp', 'kml', 'arraybuffer'];

    // extract input
    var body      = (req.body) ? req.body : {};
    _.extend(req.query, body);
    var sql       = req.query.q;
    var api_key   = req.query.api_key;
    var database  = req.query.database; // TODO: Deprecate
    var limit     = parseInt(req.query.rows_per_page);
    var offset    = parseInt(req.query.page);
    var requestedFormat = req.query.format;
    var format    = _.isArray(requestedFormat) ? _.last(requestedFormat) : requestedFormat;
    var requestedFilename = req.query.filename;
    var filename  = requestedFilename;
    var requestedSkipfields = req.query.skipfields;
    var skipfields;
    var dp        = req.query.dp; // decimal point digits (defaults to 6)
    var gn        = "the_geom"; // TODO: read from configuration file
    var user_id;
    var tableCacheItem;
    var requestProtocol = req.protocol;

    try {

        // sanitize and apply defaults to input
        dp        = (dp       === "" || _.isUndefined(dp))       ? '6'  : dp;
        format    = (format   === "" || _.isUndefined(format))   ? 'json' : format.toLowerCase();
        filename  = (filename === "" || _.isUndefined(filename)) ? 'cartodb-query' : sanitize_filename(filename);
        sql       = (sql      === "" || _.isUndefined(sql))      ? null : sql;
        database  = (database === "" || _.isUndefined(database)) ? null : database;
        limit     = (!_.isNaN(limit))  ? limit : null;
        offset    = (!_.isNaN(offset)) ? offset * limit : null;
        console.log("offset", offset);

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
        if ( ! formats.hasOwnProperty(format) ) 
          throw new Error("Invalid format: " + format);

        if (!_.isString(sql)) throw new Error("You must indicate a sql query");

        // initialise MD5 key of sql for cache lookups
        var sql_md5 = generateMD5(sql);

        // placeholder for connection
        var pg;

        var authenticated;

        var formatter;

        // 1. Get database from redis via the username stored in the host header subdomain
        // 2. Run the request through OAuth to get R/W user id if signed
        // 3. Get the list of tables affected by the query
        // 4. Setup headers
        // 5. Send formatted results back
        Step(
            function getDatabaseName() {
                if (_.isNull(database)) {
                    Meta.getDatabase(req, this);
                } else {
                    // database hardcoded in query string (deprecated??): don't use redis
                    return database;
                }
            },
            function setDBGetUser(err, data) {
                if (err) throw err;

                database = (data === "" || _.isNull(data) || _.isUndefined(data)) ? database : data;

                // If the database could not be found, the user is non-existant
                if (_.isNull(database)) {
                    var msg = "Sorry, we can't find this CartoDB. Please check that you have entered the correct domain.";
                    err = new Error(msg);
                    err.http_status = 404;
                    throw err;
                }

                if(api_key) {
                    ApiKeyAuth.verifyRequest(req, this);
                } else {
                    oAuth.verifyRequest(req, this, requestProtocol);
                }
            },
            function queryExplain(err, data){
                if (err) throw err;
                user_id = data;
                // store postgres connection
                pg = new PSQL(user_id, database);

                authenticated = ! _.isNull(user_id);

                // get all the tables from Cache or SQL
                tableCacheItem = tableCache.get(sql_md5);
                if (tableCacheItem) {
                   tableCacheItem.hits++;
                   return false;
                } else {
                   pg.query("SELECT CDB_QueryTables($quotesql$" + sql + "$quotesql$)", this);
                }
            },
            function setHeaders(err, result){
                if (err) throw err;

                // store explain result in local Cache
                if ( ! tableCacheItem ) {

                    if ( result.rowCount === 1 ) {
                      tableCacheItem = {
                        affected_tables: result.rows[0].cdb_querytables, 
                        // check if query may possibly write
                        may_write: queryMayWrite(sql),
                        // initialise hit counter
                        hits: 1
                      };
                      tableCache.set(sql_md5, tableCacheItem);
                    } else {
                      console.log("[ERROR] Unexpected result from CDB_QueryTables($quotesql$" + sql + "$quotesql$)");
                      console.dir(result);
                    }
                }

                if ( tableCacheItem ) {
                    var affected_tables = tableCacheItem.affected_tables.split(/^\{(.*)\}$/)[1].split(',');
                    for ( var i=0; i<affected_tables.length; ++i ) {
                      var t = affected_tables[i];
                      if ( t.match(/\.?pg_/) ) {
                        var e = new SyntaxError("system tables are forbidden");
                        e.http_status = 403;
                        throw(e);
                      }
                    }
                }


                var fClass = formats[format]
                formatter = new fClass();


                // configure headers for given format
                var use_inline = !requestedFormat && !requestedFilename;
                res.header("Content-Disposition", getContentDisposition(format, filename, use_inline));
                res.header("Content-Type", formatter.getContentType());

                // allow cross site post
                setCrossDomain(res);

                // set cache headers
                res.header('X-Cache-Channel', generateCacheKey(database, tableCacheItem, authenticated));
                var cache_policy = req.query.cache_policy;
                if ( cache_policy == 'persist' ) {
                  res.header('Cache-Control', 'public,max-age=31536000'); // 1 year
                } else {
                  // don't cache the result !
                  // NOTE: both Varnish and Cloudfront ignore this header,
                  //       X-Cache-Channel is for controlling Varnish
                  //       Cloudfront can only be skipped perturbating the URL
                  //       
                  res.header('Last-Modified', new Date().toUTCString());
                  res.header('Cache-Control', 'no-cache,max-age=0,must-revalidate,public');
                }

                return result;
            },
            function generateFormat(err, result){
                if (err) throw err;

                // TODO: drop this, fix UI!
                sql = PSQL.window_sql(sql,limit,offset);

                var opts = {
                  sink: res,
                  gn: gn,
                  dp: dp,
                  skipfields: skipfields,
                  database: database,
                  user_id: user_id,
                  sql: sql,
                  filename: filename
                }

                formatter.sendResponse(opts, this);
            },
            function errorHandle(err){
                if ( err ) handleException(err, res);
            }
        );
    } catch (err) {
        console.log('[ERROR]\n' + err);
        handleException(err, res);
    }
}

function handleCacheStatus(req, res){
    var tableCacheValues = tableCache.values();
    var totalExplainHits = _.reduce(tableCacheValues, function(memo, res) { return memo + res.hits}, 0);
    var totalExplainKeys = tableCacheValues.length;
    res.send({explain: {pid: process.pid, hits: totalExplainHits, keys : totalExplainKeys }});
}


// TODO: delegate to formats
function getContentDisposition(format, filename, inline) {
    var ext = 'json';
    if (format === 'geojson'){
        ext = 'geojson';
    }
    else if (format === 'topojson'){
        ext = 'topojson';
    }
    else if (format === 'csv'){
        ext = 'csv';
    }
    else if (format === 'svg'){
        ext = 'svg';
    }
    else if (format === 'shp'){
        ext = 'zip';
    }
    else if (format === 'kml'){
        ext = 'kml';
    }
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
      return database + ":" + query_info.affected_tables.split(/^\{(.*)\}$/)[1];
    }
}

function generateMD5(data){
    var hash = crypto.createHash('md5');
    hash.update(data);
    return hash.digest('hex');
}


function handleException(err, res){
    var msg = (global.settings.environment == 'development') ? {error:[err.message], stack: err.stack} : {error:[err.message]}
    if (global.settings.environment !== 'test'){
        // TODO: email this Exception report
        console.log("EXCEPTION REPORT")
        console.log(err.message);
        console.log(err.stack);
    }

    // allow cross site post
    setCrossDomain(res);

    // Force inline content disposition
    res.header("Content-Disposition", 'inline');

    // if the exception defines a http status code, use that, else a 400
    if (!_.isUndefined(err.http_status)){
        res.send(msg, err.http_status);
    } else {
        res.send(msg, 400);
    }
}

module.exports = app;
