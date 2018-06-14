require('../helper');

const fs = require('fs');
const querystring = require('querystring');
const assert = require('../support/assert');
const os = require('os');
const { Client } = require('pg');
const request = require('request');

const StatsClient = require('../../app/stats/client');
if (global.settings.statsd) {
    // Perform keyword substitution in statsd
    if (global.settings.statsd.prefix) {
        const hostToken = os.hostname().split('.').reverse().join('.');
        global.settings.statsd.prefix = global.settings.statsd.prefix.replace(/:host/, hostToken);
    }
}
const statsClient = StatsClient.getInstance(global.settings.statsd);
const server = require('../../app/server')(statsClient);


describe('copy-endpoints', function() {
    describe('general', function() {
        before(function(done) {
            const client = new Client({
                user: 'postgres',
                host: 'localhost',
                database: 'cartodb_test_user_1_db',
                port: 5432,
            });
            client.connect();
            client.query('TRUNCATE copy_endpoints_test', (err/*, res */) => {
                client.end();
                done(err);
            });
        });
    
        it('should work with copyfrom endpoint', function(done){
            assert.response(server, {
                url: "/api/v1/sql/copyfrom?" + querystring.stringify({
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv'),
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'POST'
            },{}, function(err, res) {
                assert.ifError(err);
                const response = JSON.parse(res.body);
                assert.equal(!!response.time, true);
                assert.strictEqual(response.total_rows, 6);    
                done();
            });
        });
    
        it('should fail with copyfrom endpoint and unexisting table', function(done){
            assert.response(server, {
                url: "/api/v1/sql/copyfrom?" + querystring.stringify({
                    q: "COPY unexisting_table (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv'),
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'POST'
            },{}, function(err, res) {
                assert.ifError(err);
                assert.deepEqual(
                    JSON.parse(res.body), 
                    {
                        error:['relation \"unexisting_table\" does not exist']
                    }
                );
                done();
            });
        });
    
        it('should fail with copyfrom endpoint and without csv', function(done){
            assert.response(server, {
                url: "/api/v1/sql/copyfrom?" + querystring.stringify({
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'POST'
            },{}, function(err, res) {
                assert.ifError(err);
                assert.deepEqual(
                    JSON.parse(res.body), 
                    {
                        error:['No rows copied']
                    }
                );
                done();
            });
        });
    
        it('should fail with copyfrom endpoint and without q', function(done){
            assert.response(server, {
                url: "/api/v1/sql/copyfrom",
                data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv'),            
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'POST'
            },{}, function(err, res) {
                assert.ifError(err);
                assert.deepEqual(
                    JSON.parse(res.body), 
                    {
                        error:["SQL is missing"]
                    }
                );
                done();
            });
        });
    
        it('should work with copyto endpoint', function(done){
            assert.response(server, {
                url: "/api/v1/sql/copyto?" + querystring.stringify({
                    q: 'COPY copy_endpoints_test TO STDOUT',
                    filename: '/tmp/output.dmp'
                }),
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'GET'
            },{}, function(err, res) {
                assert.ifError(err);
                assert.strictEqual(
                    res.body, 
                    '11\tPaul\t10\n12\tPeter\t10\n13\tMatthew\t10\n14\t\\N\t10\n15\tJames\t10\n16\tJohn\t10\n'
                );
    
                assert.equal(res.headers['content-disposition'], 'attachment; filename=%2Ftmp%2Foutput.dmp');
                assert.equal(res.headers['content-type'], 'application/octet-stream');
    
                done();
            });
        });
    
        it('should fail with copyto endpoint and without sql', function(done){
            assert.response(server, {
                url: "/api/v1/sql/copyto?" + querystring.stringify({
                    filename: '/tmp/output.dmp'
                }),
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'GET'
            },{}, function(err, res) {
                assert.ifError(err);
                assert.deepEqual(
                    JSON.parse(res.body), 
                    {
                        error:["SQL is missing"]
                    }
                );
                done();
            });
        });
    
        it('should work with copyfrom and gzip', function(done){
            assert.response(server, {
                url: "/api/v1/sql/copyfrom?" + querystring.stringify({
                    q: "COPY copy_endpoints_test2 (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv.gz'),
                headers: {
                    host: 'vizzuality.cartodb.com', 
                    'content-encoding': 'gzip'
                },
                method: 'POST'
            },{}, function(err, res) {
                assert.ifError(err);
                const response = JSON.parse(res.body);
                assert.equal(!!response.time, true);
                assert.strictEqual(response.total_rows, 6);
                done();
            });
        });
    
    });
    
    
    describe('timeout', function() {       
        it('should fail with copyfrom and timeout', function(done){
            assert.response(server, {
                url: '/api/v1/sql?q=set statement_timeout = 10',
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'GET'
            },
            function(err) {
                assert.ifError(err);
                assert.response(server, {
                    url: "/api/v1/sql/copyfrom?" + querystring.stringify({
                        q: `COPY copy_endpoints_test (id, name) 
                            FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)`
                    }),
                    data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv'),
                    headers: {host: 'vizzuality.cartodb.com'},
                    method: 'POST'
                },
                {
                    status: 429,
                    headers: { 'Content-Type': 'application/json; charset=utf-8' }
                },
                function(err, res) {
                    assert.ifError(err);
                    assert.deepEqual(JSON.parse(res.body), {
                        error: [
                            'You are over platform\'s limits. Please contact us to know more details'
                        ],
                        context: 'limit',
                        detail: 'datasource'
                    });
        
                    
                    assert.response(server, {
                        url: "/api/v1/sql?q=set statement_timeout = 2000",
                        headers: {host: 'vizzuality.cartodb.com'},
                        method: 'GET'
                    },
                    done);
                });
            });
        });
    
        it('should fail with copyto and timeout', function(done){
            assert.response(server, {
                url: '/api/v1/sql?q=set statement_timeout = 20',
                headers: {host: 'vizzuality.cartodb.com'},
                method: 'GET'
            },
            function(err) {
                assert.ifError(err);
                assert.response(server, {
                    url: "/api/v1/sql/copyto?" + querystring.stringify({
                        q: 'COPY populated_places_simple_reduced TO STDOUT',
                        filename: '/tmp/output.dmp'
                    }),
                    headers: {host: 'vizzuality.cartodb.com'},
                    method: 'GET'
                },{}, function(err, res) {
                    assert.ifError(err);
                    const error = {
                        error:["You are over platform's limits. Please contact us to know more details"],
                        context:"limit",
                        detail:"datasource"
                    };
                    const expectedError = res.body.substring(res.body.length - JSON.stringify(error).length);
                    assert.deepEqual(JSON.parse(expectedError), error);
                    
                    assert.response(server, {
                        url: "/api/v1/sql?q=set statement_timeout = 2000",
                        headers: {host: 'vizzuality.cartodb.com'},
                        method: 'GET'
                    },
                    done);
                });
            });
        });
    });
    
    
    describe('db connections', function() {
        before(function() {
            this.db_pool_size = global.settings.db_pool_size;
            global.settings.db_pool_size = 1;
        });
    
        after(function() {
            global.settings.db_pool_size = this.db_pool_size;
        });
    
        it('copyfrom', function(done) {
            function doCopyFrom() {
                return new Promise(resolve => {
                    assert.response(server, {
                        url: "/api/v1/sql/copyfrom?" + querystring.stringify({
                            q: `COPY copy_endpoints_test (id, name) 
                                FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)`
                        }),
                        data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv'),
                        headers: {host: 'vizzuality.cartodb.com'},
                        method: 'POST'
                    },{}, function(err, res) {
                        assert.ifError(err);
                        const response = JSON.parse(res.body);
                        assert.ok(response.time);
                        resolve();
                    });
                });
            }
    
            Promise.all([doCopyFrom(), doCopyFrom(), doCopyFrom()]).then(function() {
                done();
            });
        });
    
        it('copyto', function(done) {
            function doCopyTo() {
                return new Promise(resolve => {
                    assert.response(server, {
                        url: "/api/v1/sql/copyto?" + querystring.stringify({
                            q: 'COPY copy_endpoints_test TO STDOUT',
                            filename: '/tmp/output.dmp'
                        }),
                        headers: {host: 'vizzuality.cartodb.com'},
                        method: 'GET'
                    },{}, function(err, res) {
                        assert.ifError(err);
                        assert.ok(res.body);
                        resolve();
                    });
                });
            }
    
            Promise.all([doCopyTo(), doCopyTo(), doCopyTo()]).then(function() {
                done();
            });
        });
    });
    
    describe('client disconnection', function() {
        // Give it enough time to connect and issue the query
        // but not too much so as to disconnect in the middle of the query.
        const CLIENT_DISCONNECT_TIMEOUT = 10;
    
        before(function() {
            this.db_pool_size = global.settings.db_pool_size;
            global.settings.db_pool_size = 1;
        });
    
        after(function() {
            global.settings.db_pool_size = this.db_pool_size;
        });
    
        var assertCanReuseConnection = function (done) {
            assert.response(server, {
                url: '/api/v1/sql?' + querystring.stringify({
                    q: 'SELECT 1',
                }),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            }, {}, function(err, res) {
                assert.ifError(err);
                assert.ok(res.statusCode === 200);
                done();
            });
        };
    
        it('COPY TO returns the connection to the pool if the client disconnects', function(done) {
            const listener = server.listen(0, '127.0.0.1');

            listener.on('error', done);
            listener.on('listening', function onServerListening () {

                const { address, port } = listener.address();
                const query = querystring.stringify({
                    q: `COPY (SELECT * FROM generate_series(1, 1000)) TO STDOUT`
                });

                const options = {
                    url: `http://${address}:${port}/api/v1/sql/copyto?${query}`,
                    headers: { host: 'vizzuality.cartodb.com' },
                    method: 'GET'
                };

                const req = request(options);

                req.once('data', () => req.abort());
                req.on('response', response => {
                    response.on('end', () => {
                        assertCanReuseConnection(done)
                    });
                });
            });
        });
    
        it('COPY FROM returns the connection to the pool if the client disconnects', function(done) {
            const listener = server.listen(0, '127.0.0.1');

            listener.on('error', done);
            listener.on('listening', function onServerListening () {

                const { address, port } = listener.address();
                const query = querystring.stringify({
                    q: `COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)`
                });

                const options = {
                    url: `http://${address}:${port}/api/v1/sql/copyfrom?${query}`,
                    headers: { host: 'vizzuality.cartodb.com' },
                    method: 'POST',
                    data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv')
                };

                const req = request(options);

                setTimeout(() => {
                    req.abort();
                    done();
                }, CLIENT_DISCONNECT_TIMEOUT);
            });
        });
    
    });
});
