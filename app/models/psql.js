var _      = require('underscore')
    , Step   = require('step')
    , pg     = require('pg');//.native; // disabled for now due to: https://github.com/brianc/node-postgres/issues/48
_.mixin(require('underscore.string'));

// PSQL
//
// A simple postgres wrapper with logic about username and database to connect
//
// * intended for use with pg_bouncer
// * defaults to connecting with a "READ ONLY" user to given DB if not passed a specific user_id
var PSQL = function(user_id, db) {

    var error_text = "Incorrect access parameters. If you are accessing via OAuth, please check your tokens are correct. For public users, please ensure your table is published."
    if (!_.isString(user_id) && !_.isString(db)) throw new Error(error_text);

    var me = {
        public_user: "publicuser"
        , user_id: user_id
        , db: db
        , client: null
    };

    me.username = function(){
        var username = this.public_user;
        if (_.isString(this.user_id))
            username = _.template(global.settings.db_user, {user_id: this.user_id});

        return username;
    };

    me.database = function(){
        var database = db;
        if (_.isString(this.user_id))
            database = _.template(global.settings.db_base_name, {user_id: this.user_id});

        return database;
    };

    // memorizes connection in object.
    // TODO: move to proper pool.
    me._connect = function(callback){
        if (this.client) {
            callback(null, this.client);
        } else {
            var conString = "tcp://" + this.username() + "@" +
                            global.settings.db_host + ":" +
                            global.settings.db_port + "/" +
                            this.database();
            var that = this
            pg.connect(conString, function(err, client){
                // FIXME: there's a race condition here,
                //        if another .connect() call was
                //        received before we had done with
                //        previous connection, the first
                //        client connected will be lost
                //        and possibly leak forever.
                that.client = client;
                callback(err, client);
            });
        }
    };

    me.query = function(sql, callback){
        var that = this;

        Step(
            function(){
                that.sanitize(sql, this);
            },
            function(err, clean){
                if (err) throw err;
                that._connect(this);
            },
            function(err, client){
                if (err) throw err;
                client.query(sql, this);
            },
            function(err, res){
                //if (err) console.log(err);
                callback(err, res)
            }
        );
    };

    /// @deprecated -- should not be called
    me._end = function(){
      // NOTE: clients created via the pg#connect method will be
      //       automatically disconnected or placed back into the
      //       connection pool and should NOT have their #end
      //       method called
      // REF: https://github.com/brianc/node-postgres/wiki/Client#method-end
      // See me.connect()
    
      // if ( this.client ) { this.client.end(); this.client = null; }

      // NOTE: maybe provide a function resumeDrain, but change its name
    };

    // throw exception if illegal operations are detected
    // NOTE: this check is weak hack, better database
    //       permissions should be used instead.
    me.sanitize = function(sql, callback){
        // NOTE: illegal table access is checked in main app
        if (sql.match(/^\s+set\s+/i)){
            var error = new SyntaxError("SET command is forbidden");
            error.http_status = 403;
            callback(error); 
            return;
        }
        callback(null,true);
    };

    return me;
};

module.exports = PSQL;
