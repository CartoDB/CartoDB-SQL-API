'use strict';

require('../helper');

const fs = require('fs');
const querystring = require('querystring');
const assert = require('../support/assert');
const os = require('os');
const path = require('path');
const { Client } = require('pg');
const request = require('request');

const StatsClient = require('../../lib/stats/client');
if (global.settings.statsd) {
    // Perform keyword substitution in statsd
    if (global.settings.statsd.prefix) {
        const hostToken = os.hostname().split('.').reverse().join('.');
        global.settings.statsd.prefix = global.settings.statsd.prefix.replace(/:host/, hostToken);
    }
}
const statsClient = StatsClient.getInstance(global.settings.statsd);
const server = require('../../lib/server')(statsClient);

const TEST_USER_ID = 1;
const TEST_USER = 'postgres';
const TEST_DB = global.settings.db_base_name.replace('<%= user_id %>', TEST_USER_ID);

// Give it enough time to connect and issue the query
// but not too much so as to disconnect in the middle of the query.
const CLIENT_DISCONNECT_TIMEOUT = 100;
const assertCanReuseCanceledConnection = function (done) {
    assert.response(server, {
        url: '/api/v1/sql?' + querystring.stringify({
            q: 'SELECT count(*) FROM copy_endpoints_test'
        }),
        headers: { host: 'vizzuality.cartodb.com' },
        method: 'GET'
    }, {}, function (err, res) {
        assert.ifError(err);
        assert.ok(res.statusCode === 200);
        const result = JSON.parse(res.body);
        assert.strictEqual(result.rows[0].count, 0);
        done();
    });
};

describe('copy-endpoints', function () {
    before(function () {
        this.client = new Client({
            user: TEST_USER,
            host: global.settings.db_host,
            database: TEST_DB,
            port: global.settings.db_batch_port
        });
        this.client.connect();
    });

    after(function () {
        this.client.end();
    });

    afterEach(function (done) {
        this.client.query('TRUNCATE copy_endpoints_test', err => {
            done(err);
        });
    });

    describe('general', function () {
        it('should work with copyfrom endpoint', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'POST'
            }, {}, function (err, res) {
                assert.ifError(err);
                const response = JSON.parse(res.body);
                assert.strictEqual(!!response.time, true);
                assert.strictEqual(response.total_rows, 2016);
                done();
            });
        });

        it('should fail with copyfrom endpoint and unexisting table', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: "COPY unexisting_table (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'POST'
            }, {}, function (err, res) {
                assert.ifError(err);
                assert.deepStrictEqual(
                    JSON.parse(res.body),
                    {
                        error: ['relation "unexisting_table" does not exist']
                    }
                );
                done();
            });
        });

        it('should fail with copyfrom endpoint and without csv', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'POST'
            }, {}, function (err, res) {
                assert.ifError(err);
                assert.deepStrictEqual(
                    JSON.parse(res.body),
                    {
                        error: ['No rows copied']
                    }
                );
                done();
            });
        });

        it('should fail with copyfrom endpoint and without q', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom',
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'POST'
            }, {}, function (err, res) {
                assert.ifError(err);
                assert.deepStrictEqual(
                    JSON.parse(res.body),
                    {
                        error: ['SQL is missing']
                    }
                );
                done();
            });
        });

        it('should work with copyto endpoint', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'POST'
            }, {}, function (err) {
                assert.ifError(err);

                assert.response(server, {
                    url: '/api/v1/sql/copyto?' + querystring.stringify({
                        q: 'COPY copy_endpoints_test TO STDOUT',
                        filename: '/tmp/output.dmp'
                    }),
                    headers: { host: 'vizzuality.cartodb.com' },
                    method: 'GET'
                }, {}, function (err, res) {
                    assert.ifError(err);
                    const regex = /11\tPaul\t10\n12\tPeter\t10\n13\tMatthew\t10\n14\t\\N\t10\n15\tJames\t10\n16\t*/g;
                    assert.ok(res.body.match(regex));

                    assert.strictEqual(res.headers['content-disposition'], 'attachment; filename=%2Ftmp%2Foutput.dmp');
                    assert.strictEqual(res.headers['content-type'], 'application/octet-stream');

                    done();
                });
            });
        });

        it('should work with copyto endpoint and POST method', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'POST'
            }, {}, function (err) {
                assert.ifError(err);

                assert.response(server, {
                    url: '/api/v1/sql/copyto',
                    data: querystring.stringify({
                        q: 'COPY copy_endpoints_test TO STDOUT',
                        filename: '/tmp/output.dmp'
                    }),
                    headers: {
                        host: 'vizzuality.cartodb.com',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    method: 'POST'
                }, {}, function (err, res) {
                    assert.ifError(err);
                    const regex = /11\tPaul\t10\n12\tPeter\t10\n13\tMatthew\t10\n14\t\\N\t10\n15\tJames\t10\n16\t*/g;
                    assert.ok(res.body.match(regex));

                    assert.strictEqual(res.headers['content-disposition'], 'attachment; filename=%2Ftmp%2Foutput.dmp');
                    assert.strictEqual(res.headers['content-type'], 'application/octet-stream');

                    done();
                });
            });
        });

        it('should fail with copyto endpoint and without sql', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyto?' + querystring.stringify({
                    filename: '/tmp/output.dmp'
                }),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            }, {}, function (err, res) {
                assert.ifError(err);
                assert.deepStrictEqual(
                    JSON.parse(res.body),
                    {
                        error: ['SQL is missing']
                    }
                );
                done();
            });
        });

        it('should work with copyfrom and gzip', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv.gz')),
                headers: {
                    host: 'vizzuality.cartodb.com',
                    'content-encoding': 'gzip'
                },
                method: 'POST'
            }, {}, function (err, res) {
                assert.ifError(err);
                const response = JSON.parse(res.body);
                assert.strictEqual(!!response.time, true);
                assert.strictEqual(response.total_rows, 6);
                done();
            });
        });

        it('should return an error when gzip headers are not correct', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                headers: {
                    host: 'vizzuality.cartodb.com',
                    'content-encoding': 'gzip'
                },
                method: 'POST'
            }, {}, function (err, res) {
                assert.ifError(err);
                assert.deepStrictEqual(
                    JSON.parse(res.body),
                    {
                        error: ['Error while gunzipping: incorrect header check']
                    }
                );
                done();
            });
        });
    });

    describe('timeout', function () {
        before('set a 1 ms timeout', function () {
            this.previous_timeout = global.settings.copy_timeout;
            global.settings.copy_timeout = 1;
        });

        after('restore previous timeout', function () {
            global.settings.copy_timeout = this.previous_timeout;
        });

        it('should fail with copyfrom and timeout', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: `COPY copy_endpoints_test (id, name)
                    FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)`
                }),
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'POST'
            },
            {
                status: 429,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            },
            function (err, res) {
                assert.ifError(err);
                assert.deepStrictEqual(JSON.parse(res.body), {
                    error: [
                        'You are over platform\'s limits: SQL query timeout error.' +
                            ' Refactor your query before running again or contact CARTO support for more details.'
                    ],
                    context: 'limit',
                    detail: 'datasource'
                });
                done();
            });
        });

        it('should fail with copyto and timeout', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyto?' + querystring.stringify({
                    q: 'COPY populated_places_simple_reduced TO STDOUT',
                    filename: '/tmp/output.dmp'
                }),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            }, {}, function (err, res) {
                assert.ifError(err);
                const error = {
                    error: ['You are over platform\'s limits: SQL query timeout error.' +
                            ' Refactor your query before running again or contact CARTO support for more details.'],
                    context: 'limit',
                    detail: 'datasource'
                };
                const expectedError = res.body.substring(res.body.length - JSON.stringify(error).length);
                assert.deepStrictEqual(JSON.parse(expectedError), error);
                done();
            });
        });
    });

    describe('db connections', function () {
        before(function () {
            this.db_pool_size = global.settings.db_pool_size;
            global.settings.db_pool_size = 1;
        });

        after(function () {
            global.settings.db_pool_size = this.db_pool_size;
        });

        it('copyfrom', function (done) {
            function doCopyFrom () {
                return new Promise(resolve => {
                    assert.response(server, {
                        url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                            q: `COPY copy_endpoints_test (id, name)
                                FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)`
                        }),
                        data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                        headers: { host: 'vizzuality.cartodb.com' },
                        method: 'POST'
                    }, {}, function (err, res) {
                        assert.ifError(err);
                        const response = JSON.parse(res.body);
                        assert.ok(response.time);
                        resolve();
                    });
                });
            }

            Promise.all([doCopyFrom(), doCopyFrom(), doCopyFrom()]).then(function () {
                done();
            });
        });

        it('copyto', function (done) {
            function doCopyTo () {
                return new Promise(resolve => {
                    assert.response(server, {
                        url: '/api/v1/sql/copyto?' + querystring.stringify({
                            q: 'COPY (SELECT * FROM generate_series(1, 10000)) TO STDOUT',
                            filename: '/tmp/output.dmp'
                        }),
                        headers: { host: 'vizzuality.cartodb.com' },
                        method: 'GET'
                    }, {}, function (err, res) {
                        assert.ifError(err);
                        assert.ok(res.body);
                        resolve();
                    });
                });
            }

            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                }),
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'POST'
            }, {}, function (err) {
                assert.ifError(err);

                Promise.all([doCopyTo(), doCopyTo(), doCopyTo()]).then(function () {
                    done();
                });
            });
        });
    });

    describe('client disconnection', function () {
        before(function () {
            this.db_pool_size = global.settings.db_pool_size;
            global.settings.db_pool_size = 1;
        });

        after(function () {
            global.settings.db_pool_size = this.db_pool_size;
        });

        const assertCanReuseConnection = function (done) {
            assert.response(server, {
                url: '/api/v1/sql?' + querystring.stringify({
                    q: 'SELECT 1'
                }),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            }, {}, function (err, res) {
                assert.ifError(err);
                assert.ok(res.statusCode === 200);
                done();
            });
        };

        it('COPY TO returns the connection to the pool if the client disconnects', function (done) {
            const listener = server.listen(0, '127.0.0.1');

            listener.on('error', done);
            listener.on('listening', function onServerListening () {
                const { address, port } = listener.address();
                const query = querystring.stringify({
                    q: 'COPY (SELECT * FROM generate_series(1, 1000)) TO STDOUT'
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
                        assertCanReuseConnection(done);
                    });
                });
            });
        });

        it('COPY FROM returns the connection to the pool if the client disconnects', function (done) {
            const listener = server.listen(0, '127.0.0.1');

            listener.on('error', done);
            listener.on('listening', function onServerListening () {
                const { address, port } = listener.address();
                const query = querystring.stringify({
                    q: 'COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER \',\', HEADER true)'
                });

                const options = {
                    url: `http://${address}:${port}/api/v1/sql/copyfrom?${query}`,
                    headers: { host: 'vizzuality.cartodb.com' },
                    method: 'POST',
                    data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv'))
                };

                const req = request(options);

                setTimeout(() => {
                    req.abort();
                    assertCanReuseCanceledConnection(done);
                }, CLIENT_DISCONNECT_TIMEOUT);
            });
        });
    });

    describe('COPY timeouts: they can take longer than statement_timeout', function () {
        before('set a very small statement_timeout for regular queries', function (done) {
            assert.response(server, {
                url: '/api/v1/sql?q=set statement_timeout = 10',
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            }, done);
        });

        after('restore normal statement_timeout for regular queries', function (done) {
            assert.response(server, {
                url: '/api/v1/sql?q=set statement_timeout = 2000',
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            }, done);
        });

        it('COPY FROM can take longer than regular statement_timeout', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: `COPY copy_endpoints_test (id, name)
                    FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)`
                }),
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'POST'
            }, {
                status: 200,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            }, function (err, res) {
                assert.ifError(err);
                const response = JSON.parse(res.body);
                assert.strictEqual(response.total_rows, 2016);
                done();
            });
        });

        it('COPY TO can take longer than regular statement_timeout', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyto?' + querystring.stringify({
                    q: 'COPY copy_endpoints_test TO STDOUT',
                    filename: '/tmp/output.dmp'
                }),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            }, {}, function (err, res) {
                assert.ifError(err);
                assert.ok(res.statusCode === 200);
                done();
            });
        });
    });

    describe('dbQuotaMiddleware', function () {
        before('Set the remaining quota to 1 byte', function (done) {
            // See the test/support/sql/quota_mock.sql
            this.client.query(`CREATE OR REPLACE FUNCTION CDB_UserDataSize(schema_name TEXT)
                              RETURNS bigint AS
                              $$
                              BEGIN
                                RETURN 250 * 1024 * 1024 - 1;
                              END;
                              $$ LANGUAGE 'plpgsql' VOLATILE;
                              `, err => done(err));

            this.db_pool_size = global.settings.db_pool_size;
            global.settings.db_pool_size = 1;
        });

        after('Restore the old quota', function (done) {
            // See the test/support/sql/quota_mock.sql
            this.client.query(`CREATE OR REPLACE FUNCTION CDB_UserDataSize(schema_name TEXT)
                              RETURNS bigint AS
                              $$
                              BEGIN
                                RETURN 200 * 1024 * 1024;
                              END;
                              $$ LANGUAGE 'plpgsql' VOLATILE;
                              `, err => done(err));

            global.settings.db_pool_size = this.db_pool_size;
        });

        it('COPY FROM fails with an error if DB quota is exhausted', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: `COPY copy_endpoints_test (id, name)
                    FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)`
                }),
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'POST'
            }, {
                status: 400,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            }, function (err, res) {
                assert.ifError(err);
                const response = JSON.parse(res.body);
                assert.deepStrictEqual(response, { error: ['DB Quota exceeded'] });

                setTimeout(() => assertCanReuseCanceledConnection(done), CLIENT_DISCONNECT_TIMEOUT);
            });
        });

        it('COPY TO is not affected by remaining DB quota', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyto?' + querystring.stringify({
                    q: 'COPY copy_endpoints_test TO STDOUT',
                    filename: '/tmp/output.dmp'
                }),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'GET'
            }, {}, function (err, res) {
                assert.ifError(err);
                assert.ok(res.statusCode === 200);
                done();
            });
        });
    });

    describe('COPY FROM max POST size', function () {
        before('Set a ridiculously small POST size limit', function () {
            this.previous_max_post_size = global.settings.copy_from_max_post_size;
            this.previous_max_post_size_pretty = global.settings.copy_from_max_post_size_pretty;
            global.settings.copy_from_max_post_size = 10;
            global.settings.copy_from_max_post_size_pretty = '10 bytes';
            this.db_pool_size = global.settings.db_pool_size;
            global.settings.db_pool_size = 1;
        });
        after('Restore the max POST size limit values', function () {
            global.settings.copy_from_max_post_size = this.previous_max_post_size;
            global.settings.copy_from_max_post_size_pretty = this.previous_max_post_size_pretty;
            global.settings.db_pool_size = this.db_pool_size;
        });

        it('honors the max POST size limit', function (done) {
            assert.response(server, {
                url: '/api/v1/sql/copyfrom?' + querystring.stringify({
                    q: `COPY copy_endpoints_test (id, name)
                    FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)`
                }),
                data: fs.createReadStream(path.join(__dirname, '/../support/csv/copy_test_table.csv')),
                headers: { host: 'vizzuality.cartodb.com' },
                method: 'POST'
            }, {
                status: 400,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            }, function (err, res) {
                assert.ifError(err);
                const response = JSON.parse(res.body);
                assert.deepStrictEqual(response, { error: ['COPY FROM maximum POST size of 10 bytes exceeded'] });

                setTimeout(() => assertCanReuseCanceledConnection(done), CLIENT_DISCONNECT_TIMEOUT);
            });
        });
    });
});
