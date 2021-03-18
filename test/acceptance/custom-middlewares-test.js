'use strict';

require('../helper');

const querystring = require('querystring');
const fs = require('fs');

const createServer = require('../../lib/server');
const assert = require('../support/assert');

describe('custom middlewares', function () {
    const RESPONSE_OK = {
        statusCode: 200
    };
    const RESPONSE_KO_TEAPOT = {
        statusCode: 418
    };

    describe('wired in /api/v1/', function () {
        before(function () {
            this.backupRoutes = global.settings.routes;

            global.settings.routes = {
                api: [{
                    paths: [
                        '/api/:version',
                        '/user/:user/api/:version'
                    ],
                    middlewares: '../../test/support/middlewares/teapot-headers.js,../../test/support/middlewares/teapot-response.js',
                    sql: [{
                        paths: [
                            '/sql'
                        ]
                    }]
                }]
            };

            this.server = createServer();
        });

        after(function () {
            global.settings.routes = this.backupRoutes;
        });

        it('GET /api/v1/health returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: '/api/v1/health',
                method: 'GET'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.headers['x-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.headers['x-again-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('GET /api/v1/version returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: '/api/v1/version',
                method: 'GET'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.headers['x-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.headers['x-again-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('GET /api/v1/sql returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: '/api/v1/sql?q=SELECT%201',
                method: 'GET'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.headers['x-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.headers['x-again-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('GET /api/v1/sql/job/:id returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: '/api/v1/sql/job/wadus',
                method: 'GET'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.headers['x-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.headers['x-again-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('POST /api/v2/sql/job returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    host: 'vizzuality.cartodb.com',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: 'SELECT * FROM untitle_table_4'
                })
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.headers['x-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.headers['x-again-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('DELETE /api/v1/sql/job/:id returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: '/api/v1/sql/job/wadus',
                method: 'DELETE'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.headers['x-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.headers['x-again-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('POST /api/v1/sql/copyfrom returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: `/api/v1/sql/copyfrom?${querystring.stringify({
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                })}`,
                data: fs.createReadStream(`${__dirname}/../support/csv/copy_test_table.csv`),
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'POST'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.headers['x-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.headers['x-again-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('GET /api/v1/sql/copyto returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: `/api/v1/sql/copyto?${querystring.stringify({
                    filename: '/tmp/output.dmp'
                })}`,
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'GET'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.headers['x-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.headers['x-again-what-am-i'], 'I\'m a teapot');
                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });
    });

    describe('wired in /api/v1/sql', function () {
        before(function () {
            this.backupRoutes = global.settings.routes;

            global.settings.routes = {
                api: [{
                    paths: [
                        '/api/:version',
                        '/user/:user/api/:version'
                    ],
                    sql: [{
                        paths: [
                            '/sql'
                        ],
                        middlewares: '../../../test/support/middlewares/teapot-response.js'
                    }]
                }]
            };

            this.server = createServer();
        });

        after(function () {
            global.settings.routes = this.backupRoutes;
        });

        it('GET /api/v1/health returns 200', function (done) {
            assert.response(this.server, {
                url: '/api/v1/health',
                method: 'GET'
            }, RESPONSE_OK, function (err, res) {
                if (err) {
                    return done(err);
                }

                const parsed = JSON.parse(res.body);

                assert.strictEqual(parsed.enabled, true);
                assert.strictEqual(parsed.ok, true);

                done();
            });
        });

        it('GET /api/v1/version returns 200', function (done) {
            assert.response(this.server, {
                url: '/api/v1/version',
                method: 'GET'
            }, RESPONSE_OK, function (err, res) {
                if (err) {
                    return done(err);
                }

                const parsed = JSON.parse(res.body);

                assert.ok(Object.prototype.hasOwnProperty.call(parsed, 'cartodb_sql_api'));

                done();
            });
        });

        it('GET /api/v1/sql returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: '/api/v1/sql?q=SELECT%201',
                method: 'GET'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('GET /api/v1/sql/job/:id returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: '/api/v1/sql/job/wadus',
                method: 'GET'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('POST /api/v2/sql/job returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: '/api/v2/sql/job?api_key=1234',
                headers: {
                    host: 'vizzuality.cartodb.com',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                method: 'POST',
                data: querystring.stringify({
                    query: 'SELECT * FROM untitle_table_4'
                })
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('DELETE /api/v1/sql/job/:id returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: '/api/v1/sql/job/wadus',
                method: 'DELETE'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('POST /api/v1/sql/copyfrom returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: `/api/v1/sql/copyfrom?${querystring.stringify({
                    q: "COPY copy_endpoints_test (id, name) FROM STDIN WITH (FORMAT CSV, DELIMITER ',', HEADER true)"
                })}`,
                data: fs.createReadStream(`${__dirname}/../support/csv/copy_test_table.csv`),
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'POST'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });

        it('GET /api/v1/sql/copyto returns 418: I\'m a teapot', function (done) {
            assert.response(this.server, {
                url: `/api/v1/sql/copyto?${querystring.stringify({
                    filename: '/tmp/output.dmp'
                })}`,
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'GET'
            }, RESPONSE_KO_TEAPOT, function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(res.body, 'I\'m a teapot');
                done();
            });
        });
    });
});
