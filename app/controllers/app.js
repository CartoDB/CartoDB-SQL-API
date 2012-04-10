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

var express= require('express')
    , app      = express.createServer(
    express.logger({
        buffer: true,
        format: '[:date] :req[X-Real-IP] \033[90m:method\033[0m \033[36m:req[Host]:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m'
    }))
    , Step       = require('step')
    , Meta       = require(global.settings.app_root + '/app/models/metadata')
    , oAuth      = require(global.settings.app_root + '/app/models/oauth')
    , PSQL       = require(global.settings.app_root + '/app/models/psql')
    , ApiKeyAuth = require(global.settings.app_root + '/app/models/apikey_auth')
    , _        = require('underscore');

app.use(express.bodyParser());
app.enable('jsonp callback');

app.all('/api/v1/sql',  function(req, res) { handleQuery(req, res) } );
app.all('/api/v1/sql.:f',  function(req, res) { handleQuery(req, res) } );
function handleQuery(req, res){

    // sanitize input
    var body      = (req.body) ? req.body : {};
    var sql       = req.query.q || body.q; // get and post
    var api_key   = req.query.api_key || body.api_key;
    var database  = req.query.database; // deprecate this in future
    var limit     = parseInt(req.query.rows_per_page);
    var offset    = parseInt(req.query.page);
    var format    = (req.query.format) ? req.query.format : null;
    var dp        = (req.query.dp) ? req.query.dp: '15';

    // validate input slightly
    dp        = (dp=== "")        ? '15' : dp;
    format    = (format === "")   ? null : format;
    sql       = (sql === "")      ? null : sql;
    database  = (database === "") ? null : database;
    limit     = (_.isNumber(limit))  ? limit : null;
    offset    = (_.isNumber(offset)) ? offset * limit : null

    // setup step run
    var that  = this;
    var start = new Date().getTime();
 
    try {
        if (!_.isString(sql)) throw new Error("You must indicate a sql query");
        var pg;

        // 1. Get database from redis via the username stored in the host header subdomain
        // 2. Run the request through OAuth to get R/W user id if signed
        // 3. Run query with r/w or public user
        // 4. package results and send back
        Step(
            function getDatabaseName(){
                Meta.getDatabase(req, this);
            },
            function setDBGetUser(err, data) {
                if (err) throw err;
                database = (data == "" || _.isNull(data)) ? database : data;
                if(api_key) {
                    ApiKeyAuth.verifyRequest(req, this);
                } else {
                    oAuth.verifyRequest(req, this);
                }
            },
            function querySql(err, user_id){
                if (err) throw err;
                pg = new PSQL(user_id, database, limit, offset);

                // TODO: refactor formats to external object
                if (format === 'geojson'){
                    sql = ['SELECT *, ST_AsGeoJSON(the_geom,',dp,') as the_geom FROM (', sql, ') as foo'].join("");
                }

                pg.query(sql, this);
            },
            function packageResults(err, result){
                if (err) throw err;

                // TODO: refactor formats to external object
                if (format === 'geojson'){
                    toGeoJSON(result, res, this);
                } else {
                    var end = new Date().getTime();
                    return {
                        'time' : ((end - start)/1000),
                        'total_rows': result.rows.length,
                        'rows'      : result.rows
                    };
                }
            },
            function sendResults(err, out){
                if (err) throw err;

                // configure headers for geojson
                res.header("Content-Disposition", getContentDisposition(format));

                // allow cross site post
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "X-Requested-With");

                // set cache headers
                res.header('Last-Modified', new Date().toUTCString());
                res.header('Cache-Control', 'no-cache,max-age=3600,must-revalidate, public');
                res.header('X-Cache-Channel', database);

                // return to browser
                res.send(out);
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

function getContentDisposition(format){
    var ext = (format === 'geojson') ? 'geojson' : 'json';
    var time = new Date().toUTCString();
    return 'inline; filename=cartodb-query.' + ext + '; modification-date="' + time + '";';
}

function handleException(err, res){
    var msg = (global.settings.environment == 'development') ? {error:[err.message], stack: err.stack} : {error:[err.message]}
    if (global.settings.environment !== 'test'){
        // TODO: email this Exception report
        console.log("EXCEPTION REPORT")
        console.log(err.message);
        console.log(err.stack);
    }

    // if the exception defines a http status code, use that, else a 500
    if (!_.isUndefined(err.http_status)){
        res.send(msg, err.http_status);
    } else {
        res.send(msg, 400);
    }
}

module.exports = app;
