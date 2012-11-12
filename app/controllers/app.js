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
    , csv         = require('csv')
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
    , tableCache  = {};

app.use(express.bodyParser());
app.enable('jsonp callback');

// basic routing
app.all('/api/v1/sql',     function(req, res) { handleQuery(req, res) } );
app.all('/api/v1/sql.:f',  function(req, res) { handleQuery(req, res) } );
app.get('/api/v1/cachestatus',  function(req, res) { handleCacheStatus(req, res) } );

// Return true of the given query may write to the database
//
// NOTE: this is a fuzzy check, the return could be true even
//       if the query doesn't really write anything.
//       But you can be pretty sure of a false return.
//
function queryMayWrite(sql) {
  var mayWrite = false;  
  var pattern = RegExp("(alter|insert|update|delete|create|drop)", "i");
  if ( pattern.test(sql) ) {
    mayWrite = true;
  }
  return mayWrite;
}

// Return database username from user_id
// NOTE: a "null" user_id is a request to use the public user
function userid_to_dbuser(user_id) {
  if ( _.isString(user_id) ) 
      return _.template(global.settings.db_user, {user_id: user_id});
  return "publicuser" // FIXME: make configurable
};

function sanitize_filename(filename) {
  filename = path.basename(filename, path.extname(filename));
  filename = filename.replace(/[;()\[\]<>'"\s]/g, '_');
  //console.log("Sanitized: " + filename);
  return filename;
}

// request handlers
function handleQuery(req, res) {

    var supportedFormats = ['json', 'geojson', 'csv', 'svg', 'shp', 'kml'];
    var svg_width  = 1024.0;
    var svg_height = 768.0;

    // extract input
    var body      = (req.body) ? req.body : {};
    var sql       = req.query.q || body.q; // HTTP GET and POST store in different vars
    var api_key   = req.query.api_key || body.api_key;
    var database  = req.query.database; // TODO: Depricate
    var limit     = parseInt(req.query.rows_per_page);
    var offset    = parseInt(req.query.page);
    var format    = _.isArray(req.query.format) ? _.last(req.query.format) : req.query.format; 
    var filename  = req.query.filename;
    var skipfields = req.query.skipfields ? req.query.skipfields.split(',') : [];
    req.query.skipfields = skipfields; // save back, for toOGR use
    var dp        = req.query.dp; // decimal point digits (defaults to 6)
    var gn        = "the_geom"; // TODO: read from configuration file 
    var user_id;

    // sanitize and apply defaults to input
    dp        = (dp       === "" || _.isUndefined(dp))       ? '6'  : dp;
    format    = (format   === "" || _.isUndefined(format))   ? 'json' : format.toLowerCase();
    filename  = (filename === "" || _.isUndefined(filename)) ? 'cartodb-query' : sanitize_filename(filename);
    sql       = (sql      === "" || _.isUndefined(sql))      ? null : sql;
    database  = (database === "" || _.isUndefined(database)) ? null : database;
    limit     = (_.isNumber(limit))  ? limit : null;
    offset    = (_.isNumber(offset)) ? offset * limit : null;

    // setup step run
    var start = new Date().getTime();

    try {

        if ( -1 === supportedFormats.indexOf(format) )
          throw new Error("Invalid format: " + format);

        if (!_.isString(sql)) throw new Error("You must indicate a sql query");

        // initialise MD5 key of sql for cache lookups
        var sql_md5 = generateMD5(sql);

        // placeholder for connection
        var pg;

        var authenticated;

        // 1. Get database from redis via the username stored in the host header subdomain
        // 2. Run the request through OAuth to get R/W user id if signed
        // 3. Get the list of tables affected by the query
        // 4. Run query with r/w or public user
        // 5. package results and send back
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
                    oAuth.verifyRequest(req, this);
                }
            },
            function queryExplain(err, data){
                if (err) throw err;
                user_id = data;
                // store postgres connection
                pg = new PSQL(user_id, database, limit, offset);

                authenticated = ! _.isNull(user_id);

                // get all the tables from Cache or SQL
                if (!_.isNull(tableCache[sql_md5]) && !_.isUndefined(tableCache[sql_md5])){
                   tableCache[sql_md5].hits++;
                   return true;
                } else {
                   pg.query("SELECT CDB_QueryTables($quotesql$" + sql + "$quotesql$)", this);
                }
            },
            function queryResult(err, result){
                if (err) throw err;

                // store explain result in local Cache
                if (_.isUndefined(tableCache[sql_md5])){
                    tableCache[sql_md5] = result;
                    tableCache[sql_md5].may_write = queryMayWrite(sql);
                    tableCache[sql_md5].hits = 1; //initialise hit counter
                }

                // TODO: refactor formats to external object
                if (format === 'geojson'){
                    sql = ['SELECT *, ST_AsGeoJSON(the_geom,',dp,') as the_geom FROM (', sql, ') as foo'].join("");
                } else if (format === 'shp') {
                    return null;
                } else if (format === 'svg') {
                    var svg_ratio = svg_width/svg_height;
                    sql = 'WITH source AS ( ' + sql + '), extent AS ( ' 
                        + ' SELECT ST_Extent(' + gn + ') AS e FROM source '
                        + '), extent_info AS ( SELECT e, '
                        + 'st_xmin(e) as ex0, st_ymax(e) as ey0, '
                        + 'st_xmax(e)-st_xmin(e) as ew, '
                        + 'st_ymax(e)-st_ymin(e) as eh FROM extent )'
                        + ', trans AS ( SELECT CASE WHEN '
                        + 'eh = 0 THEN ' + svg_width
                        + '/ COALESCE(NULLIF(ew,0),' + svg_width +') WHEN '
                        + svg_ratio + ' <= (ew / eh) THEN ('
                        + svg_width  + '/ew ) ELSE ('
                        + svg_height + '/eh ) END as s '
                        + ', ex0 as x0, ey0 as y0 FROM extent_info ) '
                        + 'SELECT st_TransScale(e, -x0, -y0, s, s)::box2d as '
                        + gn + '_box, ST_Dimension(' + gn + ') as ' + gn
                        + '_dimension, ST_AsSVG(ST_TransScale(' + gn + ', '
                        + '-x0, -y0, s, s), 0, ' + dp + ') as ' + gn
                        //+ ', ex0, ey0, ew, eh, s ' // DEBUG ONLY
                        + ' FROM trans, extent_info, source';
                }

                pg.query(sql, this);
            },
            function setHeaders(err, result){
                if (err) throw err;

                // configure headers for given format
                res.header("Content-Disposition", getContentDisposition(format, filename));
                res.header("Content-Type", getContentType(format));

                // allow cross site post
                setCrossDomain(res);

                // set cache headers
                res.header('X-Cache-Channel', generateCacheKey(database, tableCache[sql_md5], authenticated));
                var cache_policy = req.query.cache_policy;
                if ( cache_policy == 'persist' ) {
                  res.header('Cache-Control', 'public,max-age=31536000'); // 1 year
                } else {
                  // TODO: set ttl=0 when tableCache[sql_md5].may_write is true ?
                  var ttl = 3600;
                  res.header('Last-Modified', new Date().toUTCString());
                  res.header('Cache-Control', 'no-cache,max-age='+ttl+',must-revalidate,public');
                }


                return result;
            },
            function packageResults(err, result){
                if (err) throw err;

                if ( skipfields.length ){
                  for ( var i=0; i<result.rows.length; ++i ) {
                    for ( var j=0; j<skipfields.length; ++j ) {
                      delete result.rows[i][skipfields[j]];
                    }
                  }
                }

                // TODO: refactor formats to external object
                if (format === 'geojson'){
                    toGeoJSON(result, res, this);
                } else if (format === 'svg'){
                    toSVG(result.rows, gn, this);
                } else if (format === 'csv'){
                    toCSV(result, res, this);
                } else if ( format === 'shp'){
                    toSHP(database, user_id, gn, sql, filename, res, this);
                } else if ( format === 'kml'){
                    toKML(database, user_id, gn, sql, res, this);
                } else if ( format === 'json'){
                    var end = new Date().getTime();

                    var json_result = {'time' : (end - start)/1000};
                        json_result.total_rows = result.rowCount;
                        json_result.rows = result.rows;
                    return json_result;
                }
                else throw new Error("Unexpected format in packageResults: " + format);
            },
            function sendResults(err, out){
                if (err) throw err;

                // return to browser
                if ( out ) res.send(out);
            },
            function errorHandle(err, result){
                handleException(err, res);
            }
        );
    } catch (err) {
        console.log('[ERROR]\n' + err);
        handleException(err, res);
    }
}

function handleCacheStatus(req, res){
    var tableCacheValues = _.values(tableCache);
    var totalExplainHits = _.reduce(tableCacheValues, function(memo, res) { return memo + res.hits}, 0);
    var totalExplainKeys = tableCacheValues.length;

    res.send({explain: {hits: totalExplainHits, keys : totalExplainKeys }});
}

// helper functions
function toGeoJSON(data, res, callback){
    try{
        var out = {
            type: "FeatureCollection",
            features: []
        };

        _.each(data.rows, function(ele){
            var geojson = {
                type: "Feature",
                properties: { },
                geometry: { }
            };
            geojson.geometry = JSON.parse(ele["the_geom"]);
            delete ele["the_geom"];
            delete ele["the_geom_webmercator"];
            geojson.properties = ele;
            out.features.push(geojson);
        });

        // return payload
        callback(null, out);
    } catch (err) {
        callback(err,null);
    }
}

function toSVG(rows, gn, callback){

    var radius = 5; // in pixels (based on svg_width and svg_height)
    var stroke_width = 1; // in pixels (based on svg_width and svg_height)
    var stroke_color = 'black';
    // fill settings affect polygons and points (circles)
    var fill_opacity = 0.5; // 0.0 is fully transparent, 1.0 is fully opaque
                            // unused if fill_color='none'
    var fill_color = 'none'; // affects polygons and circles

    var bbox; // will be computed during the results scan
    var polys = [];
    var lines = [];
    var points = [];
    _.each(rows, function(ele){
        var g = ele[gn];
        if ( ! g ) return; // null or empty
        var gdims = ele[gn + '_dimension'];

        // TODO: add an identifier, if any of "cartodb_id", "oid", "id", "gid" are found
        // TODO: add "class" attribute to help with styling ?
        if ( gdims == '0' ) {
          points.push('<circle r="[RADIUS]" ' + g + ' />');
        } else if ( gdims == '1' ) {
          // Avoid filling closed linestrings
          var linetag = '<path ';
          if ( fill_color != 'none' ) linetag += 'fill="none" '
          linetag += 'd="' + g + '" />';
          lines.push(linetag);
        } else if ( gdims == '2' ) {
          polys.push('<path d="' + g + '" />');
        }

        if ( ! bbox ) { 
          // Parse layer extent: "BOX(x y, X Y)"
          // NOTE: the name of the extent field is
          //       determined by the same code adding the
          //       ST_AsSVG call (in queryResult)
          //
          bbox = ele[gn + '_box'];
          bbox = bbox.match(/BOX\(([^ ]*) ([^ ,]*),([^ ]*) ([^)]*)\)/);
          bbox = {
            xmin: parseFloat(bbox[1]),
            ymin: parseFloat(bbox[2]), 
            xmax: parseFloat(bbox[3]),
            ymax: parseFloat(bbox[4]) 
           };
        }
    });

    // Set point radius
    for (var i=0; i<points.length; ++i) {
      points[i] = points[i].replace('[RADIUS]', radius);
    }

    var header_tags = [
        '<?xml version="1.0" standalone="no"?>',
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
    ];

    var root_tag = '<svg ';
    if ( bbox ) {
      // expand box by "radius" + "stroke-width"
      // TODO: use a Box2d class for these ops
      var growby = radius+stroke_width;
      bbox.xmin -= growby;
      bbox.ymin -= growby;
      bbox.xmax += growby;
      bbox.ymax += growby;
      bbox.width = bbox.xmax - bbox.xmin;
      bbox.height = bbox.ymax - bbox.ymin;
      root_tag += 'viewBox="' + bbox.xmin + ' ' + (-bbox.ymax) + ' '
               + bbox.width + ' ' + bbox.height + '" '; 
    }
    root_tag += 'style="fill-opacity:' + fill_opacity
              + '; stroke:' + stroke_color
              + '; stroke-width:' + stroke_width
              + '; fill:' + fill_color
              + '" ';
    root_tag += 'xmlns="http://www.w3.org/2000/svg" version="1.1">';

    header_tags.push(root_tag);

    // Render points on top of lines and lines on top of polys
    var out = header_tags.concat(polys, lines, points);

    out.push('</svg>');

    // return payload
    callback(null, out.join("\n"));
}

function toCSV(data, res, callback){
    try{
        // pull out keys for column headers
        var columns = data.rows.length ? _.keys(data.rows[0]) : [];

        // stream the csv out over http
        csv()
          .from(data.rows)
          .toStream(res, {end: true, columns: columns, header: true});
        return true;
    } catch (err) {
        callback(err,null);
    }
}

// Internal function usable by all OGR-driven outputs
function toOGR(dbname, user_id, gcol, sql, res, out_format, out_filename, callback) {
  var ogr2ogr = 'ogr2ogr'; // FIXME: make configurable
  var dbhost = global.settings.db_host; 
  var dbport = global.settings.db_port; 
  var dbuser = userid_to_dbuser(user_id);
  var dbpass = ''; // turn into a parameter..

  var tmpdir = '/tmp'; // FIXME: make configurable
  var columns = [];

  var skipfields = res.req.query.skipfields;
  skipfields.push( "the_geom_webmercator" );

  Step (

    function fetchColumns() {
      var colsql = 'SELECT * FROM (' + sql + ') as _cartodbsqlapi LIMIT 1';
      var pg = new PSQL(user_id, dbname, 1, 0);
      pg.query(colsql, this);
    },
    function spawnDumper(err, result) {
      if (err) throw err;

      if ( ! result.rows.length ) 
        throw new Error("Query returns no rows");

      // Skip system columns
      for (var k in result.rows[0]) {
        if ( skipfields.indexOf(k) != -1 ) continue;
        columns.push('"' + k + '"');
      }
      //console.log(columns.join(','));

      var next = this;

      sql = 'SELECT ' + columns.join(',')
          + ' FROM (' + sql + ') as _cartodbsqlapi';

      var child = spawn(ogr2ogr, [
        '-f', out_format, 
        out_filename,
        "PG:host=" + dbhost
         + " user=" + dbuser
         + " dbname=" + dbname
         + " password=" + dbpass
         + " tables=fake" // trick to skip query to geometry_columns 
         + "",
        '-sql', sql 
      ]);

/*
console.log(['ogr2ogr',
        '-f', out_format,
        out_filename,
        "'PG:host=" + dbhost
         + " user=" + dbuser
         + " dbname=" + dbname
         + " password=" + dbpass
         + " tables=fake" // trick to skip query to geometry_columns
         + "'",
        '-sql "', sql, '"'].join(' '));
*/

      var stdout = '';
      child.stdout.on('data', function(data) {
        stdout += data;
        //console.log('stdout: ' + data);
      });

      var stderr = '';
      child.stderr.on('data', function(data) {
        stderr += data;
        console.log('ogr2ogr stderr: ' + data);
      });

      child.on('exit', function(code) {
        if ( code ) {
          next(new Error("ogr2ogr returned an error (error code " + code + ")\n" + stderr));
        } else {
          next(null);
        }
      });
    },
    function finish(err) {
      callback(err); 
    }
  );
}

function toSHP(dbname, user_id, gcol, sql, filename, res, callback) {
  var zip = 'zip'; // FIXME: make configurable
  var tmpdir = '/tmp'; // FIXME: make configurable
  var outdirpath = tmpdir + '/sqlapi-shapefile-' + generateMD5(sql);
  var shapefile = outdirpath + '/' + filename + '.shp';

  // TODO: following tests:
  //  - fetch with no auth [done]
  //  - fetch with auth [done]
  //  - fetch same query concurrently
  //  - fetch query with no "the_geom" column

  // TODO: Check if the file already exists
  // (should mean another export of the same query is in progress)

  Step (

    function createOutDir() {
      fs.mkdir(outdirpath, 0777, this);
    },
    function spawnDumper(err) {
      if ( err ) {
        if ( err.code == 'EEXIST' ) {
          // TODO: this could mean another request for the same
          //       resource is in progress, in which case we might want
          //       to queue the response to after it's completed...
          console.log("Reusing existing SHP output directory for query: " + sql);
        } else {
          throw err;
        }
      }
      toOGR(dbname, user_id, gcol, sql, res, 'ESRI Shapefile', shapefile, this);
    },
    function zipAndSendDump(err) {
      if ( err ) throw err;

      var next = this;
      var dir = outdirpath;

      var zipfile = dir + '.zip';

      var child = spawn(zip, ['-qrj', '-', dir ]);

      child.stdout.on('data', function(data) {
        res.write(data);
      });

      var stderr = '';
      child.stderr.on('data', function(data) {
        stderr += data;
        console.log('zip stderr: ' + data);
      });

      child.on('exit', function(code) {
        if (code) {
          res.statusCode = 500;
          //res.send(stderr);
        }
        //console.log("Zip complete, zip return code was " + code);
        next(null);
      });

    },
    function cleanupDir(topError) {

      var next = this;

      //console.log("Cleaning up " + outdirpath);

      // Unlink the dir content
      var unlinkall = function(dir, files, finish) {
        var f = files.shift();
        if ( ! f ) { finish(null); return; }
        var fn = dir + '/' + f;
        fs.unlink(fn, function(err) {
          if ( err ) {
            console.log("Unlinking " + fn + ": " + err);
            finish(err);
          }
          else unlinkall(dir, files, finish)
        });
      }
      fs.readdir(outdirpath, function(err, files) {
        if ( err ) {
          if ( err.code != 'ENOENT' ) {
            next(new Error([topError, err].join('\n')));
          } else {
            next(topError);
          }
        } else {
          unlinkall(outdirpath, files, function(err) {
            fs.rmdir(outdirpath, function(err) {
              if ( err ) console.log("Removing dir " + path + ": " + err);
              next(topError);
            });
          });
        }
      });
    },
    function finish(err) {
      if ( err ) callback(err); 
      else {
        res.end();
        callback(null);
      }

    }
  );
}

function toKML(dbname, user_id, gcol, sql, res, callback) {
  var zip = 'zip'; // FIXME: make configurable
  var tmpdir = '/tmp'; // FIXME: make configurable
  var outdirpath = tmpdir + '/sqlapi-kmloutput-' + generateMD5(sql);
  var dumpfile = outdirpath + '/cartodb-query.kml';

  // TODO: following tests:
  //  - fetch with no auth 
  //  - fetch with auth 
  //  - fetch same query concurrently
  //  - fetch query with no "the_geom" column

  Step (

    function createOutDir() {
      fs.mkdir(outdirpath, 0777, this);
    },
    function spawnDumper(err) {
      if ( err ) {
        if ( err.code == 'EEXIST' ) {
          // TODO: this could mean another request for the same
          //       resource is in progress, in which case we might want
          //       to queue the response to after it's completed...
          console.log("Reusing existing KML output directory for query: " + sql);
        } else {
          throw err;
        }
      }
      toOGR(dbname, user_id, gcol, sql, res, 'KML', dumpfile, this);
    },
    function sendResults(err) {

      if ( ! err ) {
        var stream = fs.createReadStream(dumpfile);
        util.pump(stream, res);
      }

      // cleanup output dir (should be safe to unlink)
      var topError = err;
      var next = this;

      //console.log("Cleaning up " + outdirpath);

      // Unlink the dir content
      var unlinkall = function(dir, files, finish) {
        var f = files.shift();
        if ( ! f ) { finish(null); return; }
        var fn = dir + '/' + f;
        fs.unlink(fn, function(err) {
          if ( err ) {
            console.log("Unlinking " + fn + ": " + err);
            finish(err);
          }
          else unlinkall(dir, files, finish)
        });
      }
      fs.readdir(outdirpath, function(err, files) {
        if ( err ) {
          if ( err.code != 'ENOENT' ) {
            next(new Error([topError, err].join('\n')));
          } else {
            next(topError);
          }
        } else {
          unlinkall(outdirpath, files, function(err) {
            fs.rmdir(outdirpath, function(err) {
              if ( err ) console.log("Removing dir " + path + ": " + err);
              next(topError);
            });
          });
        }
      });
    },
    function finish(err) {
      if ( err ) callback(err); 
      else {
        res.end();
        callback(null);
      }

    }
  );
}

function getContentDisposition(format, filename) {
    var ext = 'json';
    if (format === 'geojson'){
        ext = 'geojson';
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
    return 'attachment; filename=' + filename + '.' + ext + '; modification-date="' + time + '";';
}

function getContentType(format){
    var type = "application/json; charset=utf-8";
    if (format === 'csv'){
        type = "text/csv; charset=utf-8; header=present";
    }
    else if (format === 'svg'){
        type = "image/svg+xml; charset=utf-8";
    }
    else if (format === 'shp'){
        type = "application/zip; charset=utf-8";
    }
    else if (format === 'kml'){
        type = "application/kml; charset=utf-8";
    }
    return type;
}

function setCrossDomain(res){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, X-Prototype-Version, X-CSRF-Token");
}

function generateCacheKey(database,tables,is_authenticated){
    if ( is_authenticated && tables.may_write ) {
      return "NONE";
    } else {
      return database + ":" + tables.rows[0].cdb_querytables.split(/^\{(.*)\}$/)[1];   
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

    // if the exception defines a http status code, use that, else a 400
    if (!_.isUndefined(err.http_status)){
        res.send(msg, err.http_status);
    } else {
        res.send(msg, 400);
    }
}

module.exports = app;
