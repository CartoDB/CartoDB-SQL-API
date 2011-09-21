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
                  express.logger({buffer:true,
                                  format:'[:req[X-Real-IP] :date] \033[90m:method\033[0m \033[36m:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m'}))
    , Step     = require('step')
    , Meta     = require(global.settings.app_root + '/app/models/metadata')
    , oAuth    = require(global.settings.app_root + '/app/models/oauth')
    , PSQL     = require(global.settings.app_root + '/app/models/psql')
    , _        = require('underscore')
    , libxml   = require("libxmljs");

app.use(express.bodyParser());
app.enable('jsonp callback');

app.get('/api/v1/sql',  function(req, res) { handleQuery(req, res) } );
app.post('/api/v1/sql', function(req, res) { handleQuery(req, res) } );
function handleQuery(req, res){

    // sanitize input
    var body      = (req.body) ? req.body : {};
    var sql       = req.query.q || body.q; // get and post
    var database  = req.query.database; // deprecate this in future
    var limit     = parseInt(req.query.rows_per_page);
    var offset    = parseInt(req.query.page);
	var format    = (req.query.format) ? req.query.format : null;
	
    sql       = (sql == "")      ? null : sql;
    database  = (database == "") ? null : database;
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
                oAuth.verifyRequest(req, this);
            },
            // TODO insert check here for if it's a map request from the internal CartoDB session key
            // TODO if it is, allow RW or R?
            function querySql(err, user_id){
                if (err) throw err;
                pg = new PSQL(user_id, database, limit, offset);
                
                if (format == 'geojson'){
					sql = ['SELECT *,ST_AsGeoJSON(the_geom) as the_geom FROM (', sql, ') as foo'].join("");
				}else if (format == 'kml'){
					sql = ['SELECT *,ST_AsKML(the_geom) as the_geom FROM (', sql, ') as foo'].join("");
				}
                pg.query(sql, this);
            },
            function packageResults(err, result){
                if (err) throw err;
                var end = new Date().getTime();
                
                if (format == 'geojson'){
					var out = {type: "FeatureCollection",
							   features: []};
					for (i=0; i < result.rows.length; i++) {
						var geojson = { type: "Feature", 
										properties: { },
										geometry: { } };
						geojson.geometry = JSON.parse(result.rows[i]["the_geom"]);
						delete result.rows[i]["the_geom"];
						delete result.rows[i]["the_geom_webmercator"];
						geojson.properties = result.rows[i];
						out.features.push(geojson);
					}
					res.send(out);
                } else if (format == 'kml'){
					var doc = new libxml.Document(function(n) {
					  n.node('kml', {xmlns: "http://www.opengis.net/kml/2.2"}, function(n) {
						n.node('Document', function(n) {
						  n.node('Folder', function(n){
							n.node('name', 'CartoDB SQL API');
							for (i=0; i < result.rows.length; i++) {
								n.node('Placemark', function(n){
									var name = result.rows[i].name ? result.rows[i].name : result.rows[i].cartodb_id;
									var geom = libxml.parseXmlString(result.rows[i].the_geom).root();
									n.node('name', name);
									n.node(geom);
									delete result.rows[i]["the_geom"];
									delete result.rows[i]["the_geom_webmercator"];
									for (var key in result.rows[i]){
										var val = result.rows[i][key];
										if (val && val != null && val != ''){
											if (typeof(val) === 'object') val = val.toString();
											n.node(key, val);
										}
									}
								});
							}
						  });
						});
					  });
					});
					res.send(doc.toString());
				}else{
					res.send({'time' : ((end - start)/1000),
						'total_rows': result.rows.length,
						'rows'      : result.rows});
				}
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


function handleException(err, res){
    var msg = (global.settings.environment == 'development') ? {error:[err.message], stack: err.stack} : {error:[err.message]}
    if (global.settings.environment !== 'test'){
        // TODO: email this Exception report
        console.log("EXCEPTION REPORT")
        console.log(err.message);
        console.log(err.stack);
    }
    res.send(msg, 400);
}

module.exports = app;
