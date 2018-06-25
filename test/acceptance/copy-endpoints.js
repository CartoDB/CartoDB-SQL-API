require('../helper');

const fs = require('fs');
const querystring = require('querystring');
const assert = require('../support/assert');
const os = require('os');
const { Client } = require('pg');

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

            assert.ok(res.headers['x-sqlapi-profiler']);
            const headers = JSON.parse(res.headers['x-sqlapi-profiler']);
            assert.ok(headers.copyFrom);
            const metrics = headers.copyFrom;
            assert.equal(metrics.size, 57);
            assert.equal(metrics.format, 'CSV');
            assert.equal(metrics.time, response.time);
            assert.equal(metrics.rows, response.total_rows);
            assert.equal(metrics.gzip, false);

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
            
            assert.ok(res.headers['x-sqlapi-profiler']);
            const headers = JSON.parse(res.headers['x-sqlapi-profiler']);
            assert.ok(headers.copyFrom);
            const metrics = headers.copyFrom;
            assert.equal(metrics.size, 57);
            assert.equal(metrics.format, 'CSV');
            assert.equal(metrics.time, response.time);
            assert.equal(metrics.rows, response.total_rows);
            assert.equal(metrics.gzip, true);
            
            done();
        });
    });

});


describe('copy-endpoints timeout', function() {       
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
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
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


describe('copy-endpoints db connections', function() {
    before(function() {
        this.db_pool_size = global.settings.db_pool_size;
        global.settings.db_pool_size = 1;
    });

    after(function() {
        global.settings.db_pool_size = this.db_pool_size;
    });

    it('copyfrom', function(done) {
        const query = "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)";
        function doCopyFrom() {
            return new Promise(resolve => {
                assert.response(server, {
                    url: "/api/v1/sql/copyfrom?" + querystring.stringify({
                        q: query
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

describe('copy-endpoints client disconnection', function() {
    // Give it enough time to connect and issue the query
    // but not too much so as to disconnect in the middle of the query.
    const client_disconnect_timeout = 10;

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
        assert.response(server, {
            url: '/api/v1/sql/copyto?' + querystring.stringify({
                q: 'COPY (SELECT * FROM generate_series(1, 100000)) TO STDOUT',
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET',
            timeout: client_disconnect_timeout
        }, {}, function(err) {
            // we're expecting a timeout error
            assert.ok(err);
            assert.ok(err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT');
            assertCanReuseConnection(done);
        });
    });

    it('COPY FROM returns the connection to the pool if the client disconnects', function(done) {
        assert.response(server, {
            url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)",
            }),
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'POST',
            data: fs.createReadStream(__dirname + '/../support/csv/copy_test_table.csv'),
            timeout: client_disconnect_timeout
        }, {}, function(err) {
            // we're expecting a timeout error
            assert.ok(err);
            assert.ok(err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT');
            assertCanReuseConnection(done);
        });
    });

});
