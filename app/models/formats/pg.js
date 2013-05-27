var Step        = require('step')
var PSQL = require(global.settings.app_root + '/app/models/psql')

function pg(id) { this.id = id; }

pg.prototype = {

  getQuery: function(sql, options) {
    return sql;
  },

  getContentType: function(){
    return this._contentType;
  },

  getFileExtension: function() {
    return this.id;
  },

};

pg.prototype.sendResponse = function(opts, callback) {
  var sql = this.getQuery(opts.sql, {
    gn: opts.gn,
    dp: opts.dp,
    skipfields: opts.skipfields
  });

  var that = this;

  var start = Date.now();

  Step (
    function sendQuery() {
      var client = new PSQL(opts.user_id, opts.database);
      client.query(sql, this);
    },
    function packageResults(err, result) {
      if (err) throw err;

      if ( result && opts.skipfields.length ){
        for ( var i=0; i<result.rows.length; ++i ) {
          for ( var j=0; j<opts.skipfields.length; ++j ) {
            delete result.rows[i][opts.skipfields[j]];
          }
        }
      }

      var end = Date.now();
      opts.total_time = (end - start)/1000;

      that.transform(result, opts, this);
    },
    function sendResults(err, out){

        if (err) throw err;

        // return to browser
        if ( out ) opts.sink.send(out);
    },
    function errorHandle(err){
        callback(err);
    }
  );
};

module.exports = pg;
