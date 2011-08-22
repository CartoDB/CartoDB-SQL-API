var _      = require('underscore')
  , pg     = require('pg').native;
  _.mixin(require('underscore.string'));  

// PSQL
//
// A simple postgres wrapper with logic about username and database to connect
//
// * intended for use with pg_bouncer
// * defaults to connecting with a "READ ONLY" user to given DB if not passed a specific user_id
var PSQL = function(user_id, db, limit, offset){

  var error_text = "Incorrect access parameters. If you are accessing via OAuth, please check your tokens are correct. For public users, please specify a database name."
  if (!_.isString(user_id) && !_.isString(db)) throw new Error(error_text);

  var me = {
      public_user: "publicuser"
    , user_id: user_id
    , db: db
    , limit: limit
    , offset: offset
    , client: null
  };      
  
  me.username = function(){
    var username = this.public_user;    
    if (_.isString(this.user_id)) 
      username = _.template(global.settings.db_user, {user_id: this.user_id});
    
    return username; 
  }
  
  me.database = function(){      
    var database = db;    
    if (_.isString(this.user_id))
      database = _.template(global.settings.db_base_name, {user_id: this.user_id});
          
    return database;
  }
  
  // memoizes connection in object. move to proper pool.
  me.connect = function(callback){
    var that = this
    var conString = "tcp://" + this.username() + "@" + global.settings.db_host + ":" + global.settings.db_port + "/" + this.database();
    
    if (that.client) {
      return callback(null, that.client);
    } else {
      pg.connect(conString, function(err, client){
        that.client = client;
        return callback(err, client);        
      });      
    }
  }
    
  me.query = function(sql, callback){
    var that = this;
    this.connect(function(err, client){      
      if (err) return callback(err, null);      
      client.query(that.window_sql(sql), function(err, result){
        return callback(err, result)
      });
    });
  };  

  me.end = function(){
    this.client.end();
  }
  
  // little hack for UI
  me.window_sql = function(sql){
    // only window select functions
    if (_.isNumber(this.limit) && _.isNumber(this.offset) && /^\s*SELECT.*$/.test(sql.toUpperCase())){
      return "SELECT * FROM (" + sql + ") AS cdbq_1 LIMIT " + this.limit + " OFFSET " + this.offset;
    } else {
      return sql;
    }    
  }
  
  return me;
};

module.exports = PSQL;
