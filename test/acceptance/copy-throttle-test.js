'use strict';

const querystring = require('querystring');
const StatsClient = require('../../lib/stats/client');
const statsClient = StatsClient.getInstance(global.settings.statsd);
const server = require('../../lib/server')(statsClient);
const request = require('request');
const assert = require('assert');
const { Readable } = require('stream');

const createTableQuery = 'CREATE TABLE copy_from_throttle AS (SELECT 0::text AS counter)';
const dropTableQuery = 'DROP TABLE copy_from_throttle';

function * counterGenerator (timeout, maxCount) {
    let counter = 0;

    /* eslint-disable */
    while (!maxCount || counter <= maxCount) {
        yield new Promise(resolve => setTimeout(() => resolve(`${counter++}`), timeout));
    }
    /* eslint-enable */

    // generate also a delayed final marker (null) to simplify handling into a stream.
    yield new Promise(resolve => setTimeout(() => resolve(null), timeout));
}

class CounterStream extends Readable {
    constructor (generator, ...args) {
        super(...args);
        this.generator = generator;
    }

    _read () {
        const res = this.generator.next();
        if (!res.done) {
            res.value.then(value => this.push(value));
        }
    }
}

describe('COPY FROM throttle', function () {
    before(function () {
        this.copy_from_minimum_input_speed = global.settings.copy_from_minimum_input_speed;
        global.settings.copy_from_minimum_input_speed = 2;

        this.copy_from_maximum_slow_input_speed_interval = global.settings.copy_from_maximum_slow_input_speed_interval;
        global.settings.copy_from_maximum_slow_input_speed_interval = 1;
    });

    after(function () {
        global.settings.copy_from_first_chunk_timeout = this.copy_from_first_chunk_timeout;
        global.settings.copy_from_maximum_slow_input_speed_interval = this.copy_from_maximum_slow_input_speed_interval;
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

        request(dropTableOptions, function (err) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    afterEach(function (done) {
        this.listener.close(done);
    });

    it('hangs while sending data', function (done) {
        const { host, port } = this;

        const copy = querystring.stringify({
            q: "COPY copy_from_throttle (counter) FROM STDIN WITH (FORMAT CSV, DELIMITER ',')",
            api_key: 1234
        });

        const options = {
            url: `http://${host}:${port}/api/v1/sql/copyfrom?${copy}`,
            headers: { host: 'vizzuality.cartodb.com' },
            body: new CounterStream(counterGenerator(600)),
            method: 'POST'
        };

        request(options, (err, res, body) => {
            if (err) {
                return done(err);
            }

            assert.strictEqual(res.statusCode, 400);
            body = JSON.parse(body);
            assert.deepStrictEqual(body, { error: ['Connection closed by server: input data too slow'] });

            done();
        });
    });

    it('does not hang while sending data', function (done) {
        const { host, port } = this;

        const copy = querystring.stringify({
            q: "COPY copy_from_throttle (counter) FROM STDIN WITH (FORMAT CSV, DELIMITER ',')",
            api_key: 1234
        });

        const options = {
            url: `http://${host}:${port}/api/v1/sql/copyfrom?${copy}`,
            headers: { host: 'vizzuality.cartodb.com' },
            body: new CounterStream(counterGenerator(400, 7)),
            method: 'POST'
        };

        request(options, (err, res) => {
            if (err) {
                return done(err);
            }
            assert.strictEqual(res.statusCode, 200);

            done();
        });
    });
});
