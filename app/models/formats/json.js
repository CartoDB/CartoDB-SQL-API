var pg  = require('./pg');
var util = require('util');

function json() {}

json.prototype = new pg('json');

var p = json.prototype;

p._contentType = "application/json; charset=utf-8";

p.formatResultFields = function(flds) {
  var nfields = {};
  for (var i=0; i<flds.length; ++i) {
    var f = flds[i];
    var cname = this.client.typeName(f.dataTypeID);
    var tname;
    if ( ! cname ) {
      tname = 'unknown(' + f.dataTypeID + ')';
    } else {
      if ( cname.match('bool') ) {
        tname = 'boolean';
      }
      else if ( cname.match(/int|float|numeric/) ) {
        tname = 'number';
      }
      else if ( cname.match(/text|char|unknown/) ) {
        tname = 'string';
      }
      else if ( cname.match(/date|time/) ) {
        tname = 'date';
      }
      else {
        tname = cname;
      }
      if ( tname && cname.match(/^_/) ) {
        tname += '[]';
      }
    }
    //console.log('cname:'+cname+' tname:'+tname);
    nfields[f.name] = { type: tname };
  }
  return nfields;
}

p.startStreaming = function() {
  if ( this.opts.profiler ) this.opts.profiler.done('startStreaming');
  this.total_rows = 0;
  if ( this.opts.beforeSink ) {
    this.opts.beforeSink();
    delete this.opts.beforeSink;
  }
  var out = '{"rows":[';
  this.opts.sink.write(out);
  this._streamingStarted = true;
};

p.handleQueryRow = function(row) {
  if ( ! this._streamingStarted ) {
    this.startStreaming();
  }
  var sf = this.opts.skipfields;
  if ( sf.length ){
    for ( var j=0; j<sf.length; ++j ) {
      delete row[sf[j]];
    }
  }
  var out = ( this.total_rows ? ',' : '' ) + JSON.stringify(row);
  this.opts.sink.write(out);
  this.total_rows++;
}

p.handleQueryEnd = function(result) {
  if ( this.error ) {
    this.callback(this.error);
    return;
  }

  if ( this.opts.profiler ) this.opts.profiler.done('gotRows');

  //console.log("Got query end, result is "); console.dir(result);

  if ( ! this._streamingStarted ) {
    this.startStreaming();
  }

  var end = Date.now();
  this.opts.total_time = (end - this.start_time)/1000;

  // Drop field description for skipped fields
  var newfields = [];
  var sf = this.opts.skipfields;
  if ( sf.length ){
    for ( var j=0; j<result.fields.length; ++j ) {
      var f = result.fields[j];
      if ( sf.indexOf(f.name) == -1 ) newfields.push(f);
    }
    result.fields = newfields;
  }

  var end = Date.now();
  var total_time = (end - this.start_time)/1000;

  var out = [
    '],', // end of "rows" array
    '"time":', JSON.stringify(total_time),
    ',"fields":', JSON.stringify(this.formatResultFields(result.fields)),
    ',"total_rows":', JSON.stringify(result.rowCount)
  ];

  if ( result.notices ) {
    var j = {};
    for (var i=0; i<result.notices.length; ++i) {
      var m = result.notices[i];
      var l = m.severity.toLowerCase() + 's';
      if ( ! j[l] ) j[l] = [];
      j[l].push(m.message);
    }
    for (var s in j) {
      out.push(',"' + s + '":');
      out.push( JSON.stringify(j[s]) );
    }
    delete j;
  }

  out.push('}');

  while (out.length) {
    var cmp = out.shift();
    this.opts.sink.write(cmp);
  }
  this.opts.sink.end();
  if ( this.opts.profiler ) this.opts.profiler.done('endStreaming');

  this.callback();
}

module.exports = json;
