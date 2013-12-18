var pg  = require('./pg');

function json() {}

json.prototype = new pg('json');

var p = json.prototype;

p._contentType = "application/json; charset=utf-8";

var typeNames = {
    16: 'boolean', // bool
    17: 'string', // bytea
    20: 'number', // int8
    21: 'number', // int2
    23: 'number', // int4
    25: 'string', // text
    26: 'number', // oid
   114: 'object', // JSON
   700: 'number', // float4
   701: 'number', // float8
  1000: 'boolean[]', // _bool
  1015: 'string[]', // _varchar
  1042: 'string', // bpchar
  1043: 'string', // varchar
  1005: 'number[]', // _int2
  1007: 'number[]', // _int4
  1014: 'string[]', // _bpchar
  1016: 'number[]', // _int8
  1021: 'number[]', // _float4
  1022: 'number[]', // _float8
  1008: 'string[]', // _regproc
  1009: 'string[]', // _text
  1114: 'date', // timestamp without timezone
  1182: 'date', // date
  1184: 'date', // timestamp
  1186: 'string', // interval
  1231: 'number[]', // _numeric
  1700: 'number', // numeric

};

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
