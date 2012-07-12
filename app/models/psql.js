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
var PSQL = function(user_id, db, limit, offset){

    var error_text = "Incorrect access parameters. If you are accessing via OAuth, please check your tokens are correct. For public users, please ensure your table is published."
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
    };

    me.database = function(){
        var database = db;
        if (_.isString(this.user_id))
            database = _.template(global.settings.db_base_name, {user_id: this.user_id});

        return database;
    };

    // memoizes connection in object. move to proper pool.
    me.connect = function(callback){
        var that = this
        var conString = "tcp://" + this.username() + "@" + global.settings.db_host + ":" + global.settings.db_port + "/" + this.database();

        if (that.client) {
            return callback(null, that.client);
        } else {
            var err = null;
            var client = new pg.Client(conString);
            client.connect();
            that.client = client;
            return callback(err, client);
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
                that.connect(this);
            },
            function(err, client){
                if (err) return callback(err, null);
                client.query(that.window_sql(sql), this);
            },
            function(err, res){
                //if (err) console.log(err);
                callback(err, res)
            }
        );
    };

    me.end = function(){
        this.client.end();
    };

    // little hack for UI
    me.window_sql = function(sql){
        // only window select functions
        if (_.isNumber(this.limit) && _.isNumber(this.offset) && /^\s*SELECT.*$/.test(sql.toUpperCase())){
            return "SELECT * FROM (" + sql + ") AS cdbq_1 LIMIT " + this.limit + " OFFSET " + this.offset;
        } else {
            return sql;
        }
    };

    // throw exception if system table detected
    me.sanitize = function(sql, callback){
        if (sql.match(/\s+pg_.+/)){
            var error = new SyntaxError("system tables are forbidden");
            error.http_status = 403;
            throw error;
        } else {
            callback(null,true);
        }
    };

    return me;
};

module.exports = PSQL;
