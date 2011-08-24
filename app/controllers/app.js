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
    , app    = express.createServer(
                express.logger({buffer:true,
                                format:'[:remote-addr :date] \033[90m:method\033[0m \033[36m:url\033[0m \033[90m:status :response-time ms -> :res[Content-Type]\033[0m'}))
    , Step   = require('step')
    , Meta   = require(global.settings.app_root + '/app/models/metadata')
    , oAuth  = require(global.settings.app_root + '/app/models/oauth')
    , PSQL   = require(global.settings.app_root + '/app/models/psql')
    , _      = require('underscore');

app.enable('jsonp callback');
app.get('/api/v1/', function(req, res){

    // sanitize input
    var sql       = req.query.sql;
    var database  = req.query.database; // deprecate this in future
    var limit     = parseInt(req.query.rows_per_page);
    var offset    = parseInt(req.query.page);

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
            function querySql(err, user_id){
                if (err) throw err;
                pg = new PSQL(user_id, database, limit, offset);
                pg.query(sql, this);
            },
            function packageResults(err, result){
                if (err) throw err;
                var end = new Date().getTime();
                res.send({'time' : ((end - start)/1000),
                    'total_rows': result.rows.length,
                    'rows'      : result.rows});
            },
            function errorHandle(err, result){
                handleException(err, res);
            }
        );
    } catch (err) {
        handleException(err, res);
    }
});

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
