'use strict';

require('../helper');

var assert = require('../support/assert');
var step = require('step');
var net = require('net');

var sqlServerDataHandler;
var sqlServerPort = 5556;
var sqlServer = net.createServer(function (c) {
    c.on('data', function (d) {
        console.log('SQL Server got data: ' + d);
        if (sqlServerDataHandler) {
            console.log('Sending data to sqlServerDataHandler');
            sqlServerDataHandler(null, d);
        }
        c.destroy();
    });
});

describe('frontend abort', function () {
    before(function (done) {
        sqlServer.listen(sqlServerPort, done);
    });

    // See https://github.com/CartoDB/CartoDB-SQL-API/issues/129
    it('aborts request', function (done) {
        // console.log("settings:"); console.dir(global.settings);
        var dbHostBackup = global.settings.db_host;
        var dbPortBackup = global.settings.db_port;
        global.settings.db_host = 'localhost';
        global.settings.db_port = sqlServerPort;
        var server = require('../../lib/server')();
        var timeout;
        step(
            function sendQuery () {
                assert.response(server, {
                    url: '/api/v1/sql?q=SELECT+1',
                    method: 'GET',
                    timeout: 1,
                    headers: { host: 'vizzuality.localhost' }
                }, {}, this);
            },
            function checkResponse (err/*, res */) {
                assert(err); // expect timeout
                assert.ok(('' + err).match(/socket/), err);
                sqlServerDataHandler = this;
                var next = this;
                // If a call does not arrive to the sql server within
                // the given timeout we're confident it means the request
                // was successfully aborted
                timeout = setTimeout(function () { next(null); }, 500);
            },
            function checkSqlServerData (err, data) {
                clearTimeout(timeout);
                assert.ok(err.message === 'ETIMEDOUT' || err.message === 'ESOCKETTIMEDOUT');
                assert.ok(!data, 'SQL Server was contacted no matter client abort');
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
        try {
            sqlServer.close(done);
        } catch (er) {
            console.log(er);
            done(); // error expected as server is probably closed already
        }
    });
});
