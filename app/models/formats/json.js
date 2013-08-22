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

function formatResultFields(flds) {
  var nfields = {};
  for (var i=0; i<flds.length; ++i) {
    var f = flds[i];
/*
    { name: 'the_geom',
      tableID: 5528687,
      columnID: 6,
      dataTypeID: 77869,
      dataTypeSize: -1,
      dataTypeModifier: -1,
      format: 'text' },
*/
    var tname = typeNames[f.dataTypeID];
    if ( ! tname ) {
      if ( f.name.match(/^the_geom/) ) {
        tname = 'geometry';
      } else {
        tname = f.dataTypeID; // unknown
      }
    }
    nfields[f.name] = { type: tname };
  }
  return nfields;
}


p.transform = function(result, options, callback) {
  var j = {
    time: options.total_time,
    fields: formatResultFields(result.fields),
    total_rows: result.rowCount,
    rows: result.rows
  }
  callback(null, j);
};

module.exports = json;
