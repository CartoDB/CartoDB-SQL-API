require('../helper');
require('../support/assert');

var assert = require('assert')
    , App = require(global.settings.app_root + '/app/controllers/app')
    , querystring = require('querystring')
    , _ = require('underscore')
    , Step = require('step')
    , net = require('net')
    , http = require('http')
    ;

var sql_server_data_handler;
var sql_server_port = 5556;
var sql_server = net.createServer(function(c) {
  c.on('data', function(d) {
    console.log("SQL Server got data: " + d);
    if ( sql_server_data_handler ) {
      console.log("Sending data to sql_server_data_handler");
      sql_server_data_handler(null, d);
    }
    c.destroy();
  });
});

suite('frontend abort', function() {

suiteSetup(function(done){
  sql_server.listen(sql_server_port, done);
});

// See https://github.com/CartoDB/CartoDB-SQL-API/issues/129
test('aborts request', function(done){
//console.log("settings:"); console.dir(global.settings);
  var db_host_backup = global.settings.db_host;
  var db_port_backup = global.settings.db_port;
  global.settings.db_host = 'localhost';
  global.settings.db_port = sql_server_port;
  var app = App();
  var timeout;
  Step(
    function sendQuery() {
      var next = this;
      assert.response(app, {
          url: '/api/v1/sql?q=SELECT+1',
          method: 'GET',
          timeout: 1,
          headers: {host: 'vizzuality.localhost' }
      },{}, function(res, err) {
          next(err, res);
      });
    },
    function checkResponse(err, res) {
      assert(err); // expect timeout
      assert.ok((''+err).match(/socket/), err);
      sql_server_data_handler = this;
      var next = this;
      // If a call does not arrive to the sql server within
      // the given timeout we're confident it means the request
      // was successfully aborted
      timeout = setTimeout(function() { next(null); }, 500);
    },
    function checkSqlServerData(err, data) {
      clearTimeout(timeout);
      assert.ok(!data, "SQL Server was contacted no matter client abort");
      // TODO: intercept logs ?
      return null;
    },
    function finish(err) {
      global.settings.db_host = db_host_backup;
      global.settings.db_port = db_port_backup;
      done(err);
    }
  );
});

suiteTeardown(function(done) {
  try {
    sql_server.close(done);
  } catch (er) {
    console.log(er);
    done(); // error expected as server is probably closed already
  }
});

});
