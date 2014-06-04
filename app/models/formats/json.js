var pg  = require('./pg');

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


p.transform = function(result, options, callback) {
  var j = {
    time: options.total_time,
    fields: this.formatResultFields(result.fields),
    total_rows: result.rowCount,
    rows: result.rows
  }
  if ( result.notices ) {
    for (var i=0; i<result.notices.length; ++i) {
      var m = result.notices[i];
      var l = m.severity.toLowerCase() + 's';
      if ( ! j[l] ) j[l] = [];
      j[l].push(m.message);
    }
  }
  callback(null, j);
};

module.exports = json;
