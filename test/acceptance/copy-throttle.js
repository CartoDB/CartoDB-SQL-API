'use strict';

const querystring = require('querystring');
const StatsClient = require('../../app/stats/client');
const statsClient = StatsClient.getInstance(global.settings.statsd);
const server = require('../../app/server')(statsClient);
const request = require('request');
const assert = require('assert');
const { Readable } = require('stream');

const createTableQuery = `CREATE TABLE copy_from_throttle AS (SELECT 0::integer AS counter)`;
const dropTableQuery = `DROP TABLE copy_from_throttle`;

function * counterGenerator (timeout) {
    let counter = 0;

    while (true) {
        yield new Promise(resolve => setTimeout(() => resolve(`${counter++}`), timeout)); // jshint ignore:line
    }
}

class CounterStream extends Readable {
    constructor(generator, ...args) {
        super(...args);
        this.generator = generator;
    }

    _read () {
        const res = this.generator.next();
        res.value.then(value => res.done ? this.push(null) : this.push(value));
    }
}

describe('COPY FROM throttle', function () {
    before(function() {
        this.copy_from_minimum_input_speed = global.settings.copy_from_minimum_input_speed;
        global.settings.copy_from_minimum_input_speed = 1;

        this.copy_from_maximum_slow_input_speed_interval = global.settings.copy_from_maximum_slow_input_speed_interval;
        global.settings.copy_from_maximum_slow_input_speed_interval = 1;

    });

    after(function() {
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

        const createTable = querystring.stringify({ q: createTableQuery, api_key: 1234});

        const createTableOptions = {
            url: `http://${host}:${port}/api/v1/sql?${createTable}`,
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'GET'
        };

        request(createTableOptions, function (err, res) {
            if (err) {
                return done(err);
            }

            assert.equal(res.statusCode, 200);

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

    it('hang while sendind data', function (done) {
        const { host, port } = this;

        const copy = querystring.stringify({
            q: "COPY copy_from_throttle (counter) FROM STDIN WITH (FORMAT CSV, DELIMITER ',')",
            api_key: 1234
        });

        const options = {
            url: `http://${host}:${port}/api/v1/sql/copyfrom?${copy}`,
            headers: { host: 'vizzuality.cartodb.com' },
            body: new CounterStream(counterGenerator(1000)),
            method: 'POST'
        };

        request(options, (err, res, body) => {
            if (err) {
                return done(err);
            }

            assert.equal(res.statusCode, 400);
            body = JSON.parse(body);
            assert.deepEqual(body, { error: ["Connection closed by server: input data too slow"] });

            done();
        });
    });
});
