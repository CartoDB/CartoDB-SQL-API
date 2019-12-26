'use strict';

require('../helper');

var assert = require('../support/assert');
var step = require('step');
var net = require('net');

var sqlServerPort = 5540;
var sqlServer = net.createServer(function (c) {
    c.destroy();
    sqlServer.close(function () {
    });
});

describe('backend crash', function () {
    before(function (done) {
        sqlServer.listen(sqlServerPort, done);
    });

    // See https://github.com/CartoDB/CartoDB-SQL-API/issues/135
    it('does not hang server', function (done) {
        var dbHostBackup = global.settings.db_host;
        var dbPortBackup = global.settings.db_port;
        global.settings.db_host = 'localhost';
        global.settings.db_port = sqlServerPort;
        var server = require('../../lib/server')();
        step(
            function sendQuery () {
                assert.response(server, {
                    url: '/api/v1/sql?q=SELECT+1',
                    method: 'GET',
                    headers: { host: 'vizzuality.localhost' }
                }, {}, this);
            },
            function checkResponse (err, res) {
                assert.ifError(err);
                assert.strictEqual(res.statusCode, 500, res.statusCode + ': ' + res.body);
                var parsed = JSON.parse(res.body);
                assert.ok(parsed.error);
                var msg = parsed.error[0];
                assert.ok(msg.match(/unexpected.*end/), msg);
                return null;
            },
            function sendAnotherQuery () {
                assert.response(server, {
                    url: '/api/v1/sql?q=SELECT+2',
                    method: 'GET',
                    headers: { host: 'vizzuality.localhost' }
                }, {}, this);
            },
            function checkResponse (err, res) {
                assert.ifError(err);
                assert.strictEqual(res.statusCode, 500, res.statusCode + ': ' + res.body);
                var parsed = JSON.parse(res.body);
                assert.ok(parsed.error);
                var msg = parsed.error[0];
                assert.ok(msg.match(/connect/), msg);
                return null;
            },
            function finish (err) {
                global.settings.db_host = dbHostBackup;
                global.settings.db_port = dbPortBackup;
                done(err);
            }
        );
    });

    after(function (done) {
        // be sure the sqlServer is closed
        if (sqlServer.listening) {
            return sqlServer.close(done);
        }

        done();
    });
});
