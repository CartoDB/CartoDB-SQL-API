require('../helper');
require('../support/assert');

var assert = require('assert')
    , App = require(global.settings.app_root + '/app/controllers/app')
    , querystring = require('querystring')
    , _ = require('underscore')
    , Step = require('step')
    , net = require('net')
    ;

var sql_server_port = 5540;
var sql_server = net.createServer(function(c) {
  console.log('server connected');
  c.destroy();
  console.log('server socket destroyed.');
  sql_server.close(function() {
  console.log('server closed');
  });
});

suite('backend crash', function() {

suiteSetup(function(done){
  sql_server.listen(sql_server_port, done);
});

// See https://github.com/CartoDB/CartoDB-SQL-API/issues/135
test('does not hang server', function(done){
//console.log("settings:"); console.dir(global.settings);
  var db_host_backup = global.settings.db_host;
  var db_port_backup = global.settings.db_port;
  global.settings.db_host = 'localhost';
  global.settings.db_port = sql_server_port;
  var app = App();
  Step(
    function sendQuery() {
      var next = this;
      assert.response(app, {
          url: '/api/v1/sql?q=SELECT+1',
          method: 'GET',
          headers: {host: 'vizzuality.localhost' }
      },{}, function(res, err) {
          next(err, res);
      });
    },
    function checkResponse(err, res) {
      if ( err ) throw err;
      assert.equal(res.statusCode, 500, res.statusCode + ': ' + res.body);
      var parsed = JSON.parse(res.body);
      assert.ok(parsed.error);
      var msg = parsed.error[0];
      assert.ok(msg.match(/unexpected.*end/), msg);
      return null;
    },
    function sendAnotherQuery() {
      var next = this;
      assert.response(app, {
          url: '/api/v1/sql?q=SELECT+2',
          method: 'GET',
          headers: {host: 'vizzuality.localhost' }
      },{}, function(res, err) {
          next(err, res);
      });
    },
    function checkResponse(err, res) {
      if ( err ) throw err;
      assert.equal(res.statusCode, 500, res.statusCode + ': ' + res.body);
      var parsed = JSON.parse(res.body);
      assert.ok(parsed.error);
      var msg = parsed.error[0];
      assert.ok(msg.match(/connect/), msg);
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
