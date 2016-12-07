require('../helper');

var assert = require('../support/assert');
var step = require('step');
var net = require('net');

var sql_server_port = 5540;
var sql_server = net.createServer(function (connection) {
    connection.destroy();
});

describe('backend crash', function() {

    before(function(done) {
        sql_server.listen(sql_server_port, done);
    });

    // See https://github.com/CartoDB/CartoDB-SQL-API/issues/135
    it('does not hang server', function(done) {
        //console.log("settings:"); console.dir(global.settings);
        var db_host_backup = global.settings.db_host;
        var db_port_backup = global.settings.db_port;
        global.settings.db_host = 'localhost';
        global.settings.db_port = sql_server_port;
        var server = require('../../app/server')();
        step(
            function sendQuery() {
                assert.response(server, {
                    url: '/api/v1/sql?q=SELECT+1',
                    method: 'GET',
                    headers: {
                        host: 'vizzuality.localhost'
                    }
                }, {}, this);
            },
            function checkResponse(err, res) {
                assert.ifError(err);
                assert.equal(res.statusCode, 500, res.statusCode + ': ' + res.body);
                var parsed = JSON.parse(res.body);
                assert.ok(parsed.error);
                var msg = parsed.error[0];
                assert.ok(msg.match(/unexpected.*end/), msg);
                return null;
            },
            function sendAnotherQuery() {
                assert.response(server, {
                    url: '/api/v1/sql?q=SELECT+2',
                    method: 'GET',
                    headers: {
                        host: 'vizzuality.localhost'
                    }
                }, {}, this);
            },
            function checkResponse(err, res) {
                assert.ifError(err);
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

    after(function(done) {
        sql_server.close(done);
    });
});
