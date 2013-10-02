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

pg.prototype.handleQueryRow = function(row, result) {
  //console.log("Got query row, row is "); console.dir(row);
  //console.log("opts are: "); console.dir(this.opts);
  var sf = this.opts.skipfields;
  if ( sf.length ){
    for ( var j=0; j<sf.length; ++j ) {
      delete row[sf[j]];
    }
  }
  result.addRow(row);
};

pg.prototype.handleQueryEnd = function(result) {
  if ( this.error ) {
    this.callback(this.error);
    return;
  }

  //console.log("Got query end, result is "); console.dir(result);

  var end = Date.now();
  this.opts.total_time = (end - this.start_time)/1000;

  // Drop field description for skipped fields
  var sf = this.opts.skipfields;
  if ( sf.length ){
    var newfields = [];
    for ( var j=0; j<result.fields.length; ++j ) {
      var f = result.fields[j];
      if ( sf.indexOf(f.name) == -1 ) newfields.push(f);
    }
    result.fields = newfields;
  }

  var that = this;

  Step (
    function packageResult() {
      that.transform(result, that.opts, this);
    },
    function sendResults(err, out){

        if (err) throw err;

        // return to browser
        if ( out ) {
          that.opts.sink.send(out);
        } else {
console.error("No output from transform, doing nothing ?!");
        }
    },
    function errorHandle(err){
        that.callback(err);
    }
  );
};

pg.prototype.sendResponse = function(opts, callback) {
  if ( this.callback ) {
    callback(new Error("Invalid double call to .sendResponse on a pg formatter"));
    return;
  }
  this.callback = callback;
  this.opts = opts;

  var sql = this.getQuery(opts.sql, {
    gn: opts.gn,
    dp: opts.dp,
    skipfields: opts.skipfields
  });

  var that = this;

  this.start_time = Date.now();

  this.client = new PSQL(opts.user_id, opts.database);
  this.client.eventedQuery(sql, function(err, query) {
      if (err) {
        callback(err);
        return;
      }

      query.on('row', that.handleQueryRow.bind(that));
      query.on('end', that.handleQueryEnd.bind(that));
      query.on('error', function(err) { that.error = err; });
  });
};

module.exports = pg;
