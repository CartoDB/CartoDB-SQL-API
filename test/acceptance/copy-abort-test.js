'use strict';

const querystring = require('querystring');
const StatsClient = require('../../lib/stats/client');
const statsClient = StatsClient.getInstance(global.settings.statsd);
const server = require('../../lib/server')(statsClient);
const request = require('request');
const assert = require('assert');

const copyQuery = `COPY (
    INSERT INTO copy_to_test
    SELECT updated_at
    FROM generate_series(
        '1984-06-14 01:00:00'::timestamp,
        '2018-06-14 01:00:00'::timestamp,
        '1 hour'::interval
    ) updated_at
    RETURNING updated_at
) TO STDOUT`;

const createTableQuery = `CREATE TABLE copy_to_test AS
    (SELECT '2018-06-15 14:49:05.126415+00'::timestamp AS updated_at)`;

const dropTableQuery = 'DROP TABLE copy_to_test';

const countQuery = 'SELECT count(1) as count FROM copy_to_test';

function countInsertedRows (host, port, callback) {
    setTimeout(function () {
        const count = querystring.stringify({ q: countQuery, api_key: 1234 });

        const options = {
            url: `http://${host}:${port}/api/v1/sql?${count}`,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        };

        request(options, function (err, res, body) {
            if (err) {
                return callback(err);
            }

            assert.strictEqual(res.statusCode, 200);
            const result = JSON.parse(body);
            callback(null, result);
        });
    }, 100);
}

describe('Cancel "copy to" commands', function () {
    before(function () {
        this.db_pool_size = global.settings.db_pool_size;
        global.settings.db_pool_size = 1;
    });

    after(function () {
        global.settings.db_pool_size = this.db_pool_size;
    });

    beforeEach(function (done) {
        this.listener = server.listen(0, '127.0.0.1');

        this.listener.on('error', done);

        this.listener.on('listening', () => {
            const { address, port } = this.listener.address();

            this.host = address;
            this.port = port;

            done();
        });
    });

    beforeEach(function (done) {
        const { host, port } = this;

        const createTable = querystring.stringify({ q: createTableQuery, api_key: 1234 });

        const createTableOptions = {
            url: `http://${host}:${port}/api/v1/sql?${createTable}`,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        };

        request(createTableOptions, function (err, res) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(res.statusCode, 200);

            done();
        });
    });

    afterEach(function (done) {
        const { host, port } = this;

        const dropTable = querystring.stringify({ q: dropTableQuery, api_key: 1234 });

        const dropTableOptions = {
            url: `http://${host}:${port}/api/v1/sql?${dropTable}`,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        };

        request(dropTableOptions, function (err, res) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(res.statusCode, 200);

            done();
        });
    });

    afterEach(function (done) {
        this.listener.close(done);
    });

    it('abort on response', function (done) {
        const { host, port } = this;

        const copy = querystring.stringify({ q: copyQuery, api_key: 1234 });

        const options = {
            url: `http://${host}:${port}/api/v1/sql/copyto?${copy}`,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        };

        const req = request(options);

        req.on('response', function () {
            req.abort();

            countInsertedRows(host, port, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(result.rows[0].count, 1);

                done();
            });
        });
    });

    it('abort on data', function (done) {
        const { host, port } = this;

        const copy = querystring.stringify({ q: copyQuery, api_key: 1234 });

        const options = {
            url: `http://${host}:${port}/api/v1/sql/copyto?${copy}`,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        };

        const req = request(options);

        req.once('data', function () {
            req.abort();

            countInsertedRows(host, port, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(result.rows[0].count, 1);

                done();
            });
        });
    });

    it('destroy on data', function (done) {
        const { host, port } = this;

        const copy = querystring.stringify({ q: copyQuery, api_key: 1234 });

        const options = {
            url: `http://${host}:${port}/api/v1/sql/copyto?${copy}`,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        };

        const req = request(options);

        let response;

        req.on('response', function (res) {
            response = res;
        });

        req.once('data', function () {
            response.destroy();

            countInsertedRows(host, port, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(result.rows[0].count, 1);

                done();
            });
        });
    });

    it('destroy on response', function (done) {
        const { host, port } = this;

        const copy = querystring.stringify({ q: copyQuery, api_key: 1234 });

        const options = {
            url: `http://${host}:${port}/api/v1/sql/copyto?${copy}`,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        };

        const req = request(options);

        req.on('response', function (response) {
            response.destroy();

            countInsertedRows(host, port, function (err, result) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(result.rows[0].count, 1);

                done();
            });
        });
    });
});
