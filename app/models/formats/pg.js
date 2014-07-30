var Step        = require('step'),
    PSQL = require(global.settings.app_root + '/app/models/psql');

function pg(id) {
    this.id = id;
}

pg.prototype = {

  getQuery: function(sql, options) {
    return sql;
  },

  getContentType: function(){
    return this._contentType;
  },

  getFileExtension: function() {
    return this.id;
  }

};

pg.prototype.handleQueryRow = function(row, result) {
  if (this.hasSkipFields) {
    var sf = this.opts.skipfields;
    for ( var j=0; j<sf.length; ++j ) {
      delete row[sf[j]];
    }
  }
  result.addRow(row);
};

pg.prototype.handleNotice = function(msg, result) {
  if ( ! result.notices ) result.notices = [];
  for (var i=0; i<msg.length; ++i) {
    var m = msg[i];
    result.notices.push(m);
  }
};

pg.prototype.handleQueryEnd = function(result) {
  this.queryCanceller = undefined;

  if ( this.error ) {
    this.callback(this.error);
    return;
  }

  if ( this.opts.profiler ) this.opts.profiler.done('gotRows');

  this.opts.total_time = (Date.now() - this.start_time)/1000;

  // Drop field description for skipped fields
  if (this.hasSkipFields) {
    var sf = this.opts.skipfields;
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
      if ( that.opts.abortChecker ) {
        that.opts.abortChecker('packageResult');
      }
      that.transform(result, that.opts, this);
    },
    function sendResults(err, out){

        if (err) throw err;

        if ( that.opts.profiler ) that.opts.profiler.done('packageResult');

        // return to browser
        if ( out ) {
          if ( that.opts.beforeSink ) that.opts.beforeSink();
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

  this.hasSkipFields = opts.skipfields.length;

  var sql = this.getQuery(opts.sql, {
    gn: opts.gn,
    dp: opts.dp,
    skipfields: opts.skipfields
  });

  var that = this;

  this.start_time = Date.now();

  this.client = new PSQL(opts.dbopts);
  this.client.eventedQuery(sql, function(err, query, queryCanceller) {
      that.queryCanceller = queryCanceller;
      if (err) {
        callback(err);
        return;
      }
      if ( that.opts.profiler ) that.opts.profiler.done('eventedQuery');

      query.on('row', that.handleQueryRow.bind(that));
      query.on('end', that.handleQueryEnd.bind(that));
      query.on('error', function(err) { that.error = err; });
      query.on('notice', function(msg) {
        that.handleNotice(msg, query._result);
      });
  });
};

pg.prototype.cancel = function() {
    if (this.queryCanceller) {
        this.queryCanceller.call();
    }
};

module.exports = pg;
