var express= require('express')
  , app    = express.createServer(
      //TODO: make logs async background + 1min or so
    express.logger({buffer:true, 
                    format:'[:remote-addr :date] \033[90m:method\033[0m \033[36m:url\033[0m \033[90m:status :response-timems -> :res[Content-Type]\033[0m'})
    )
    
  , Step   = require(global.settings.app_root + '/lib/step')
  , oAuth  = require(global.settings.app_root + '/app/models/oauth')
  , PSQL   = require(global.settings.app_root + '/app/models/psql')  
  , _      = require('underscore');
  _.mixin(require('underscore.string'));


// CartoDB v1 SQL API
//
// all requests expect the following URL args:
// - `sql` {String} SQL to execute
//
// for private (read/write) queries:
// - `auth_token` {String} oAuth API token from CartoDB. In URL or request header.
//
// eg. /api/v1/?sql=SELECT 1 as one&auth_token=my_token
//
// for public (read only) queries:
// - `database` {String} The database to execute queries on
//
// eg. /api/v1/?sql=SELECT 1 as one&database=my_public_db
//
// NOTE: private queries can only be ran on databases the oAuth key gives access to.
app.get('/api/v1/', function(req, res){

  //sanitize input
  var sql       = req.query.sql;
  var database  = req.query.database; 
  sql      = (sql == "")      ? null : sql;
  database = (database == "") ? null : database;  
  var start = new Date().getTime();
    
  try {
    if (!_.isString(sql)) throw new Error("You must indicate a sql query");
    var pg;
    
    Step(
      function getUser() {   
        oAuth.authorize(req, this);        
      },
      function querySql(err, user_id){
        if (err) throw err;
        pg = new PSQL(user_id, database);
        pg.query(sql, this);
      },
      function packageResults(err, result){
        if (err) throw err;
        var end = new Date().getTime();
        res.send({'time'      : ((end - start)/1000),
                  'total_rows': result.rows.length, 
                  'rows'      : result.rows});
      },
      function exceptionHandle(err, result){
        handleException(res,err);      
      }
    );  
  } catch (err) {
    handleException(res,err);
  }  
});

function handleException(res, err){
  var msg = (global.settings.environment == 'development') ? {error:[err.message], stack: err.stack} : {error:[err.message]}
  res.send(msg, 400);  
}

//app.listen(global.settings.node_port);

// Think of putting it behind a cluster in production
module.exports = app;
