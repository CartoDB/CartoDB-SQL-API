'use strict';

require('../helper');

const server = require('../../lib/server')();
const assert = require('../support/assert');
const qs = require('querystring');
const BatchTestClient = require('../support/batch-test-client');
const { TYPES } = require('../../lib/api/middlewares/log');

const QUERY = 'SELECT 14 as foo';
const API_KEY = 1234;

const logQueries = global.settings.logQueries;

describe('Log middleware', function () {
    before(function () {
        global.settings.logQueries = true;
    });

    after(function () {
        global.settings.logQueries = logQueries;
    });

    describe('regular queries endpoint', function () {
        ['GET', 'POST'].forEach(method => {
            it(`${method} query`, function (done) {
                assert.response(server,
                    {
                        method,
                        url: '/api/v1/sql?' + qs.stringify({
                            q: QUERY,
                            api_key: API_KEY
                        }),
                        headers: {
                            host: 'vizzuality.cartodb.com'
                        }
                    },
                    { statusCode: 200 },
                    function (err, res) {
                        assert.ok(!err);

                        assert.ok(res.headers['x-sqlapi-log']);
                        const log = JSON.parse(res.headers['x-sqlapi-log']);
                        assert.deepStrictEqual(log, {
                            request: {
                                sql: {
                                    type: TYPES.QUERY,
                                    sql: QUERY
                                }
                            }
                        });

                        return done();
                    }
                );
            });

            it(`${method} Respects max header size with long queries`, function (done) {
                let longQuery = "Select '";
                for (let i = 0; i < 7000; i++) {
                    longQuery += 'a';
                }
                longQuery += "' as foo";
                assert.response(server,
                    {
                        method,
                        url: '/api/v1/sql?' + qs.stringify({
                            q: longQuery,
                            api_key: API_KEY
                        }),
                        headers: {
                            host: 'vizzuality.cartodb.com'
                        }
                    },
                    { statusCode: 200 },
                    function (err, res) {
                        assert.ok(!err);

                        assert.ok(res.headers['x-sqlapi-log']);
                        assert.ok(res.headers['x-sqlapi-log'].length < 5000);

                        return done();
                    }
                );
            });
        });
    });

    describe('batch api queries', function () {
        before(function () {
            this.batchTestClient = new BatchTestClient();
            assert.ok(this.batchTestClient);
        });

        after(function (done) {
            this.batchTestClient.drain(done);
        });

        it('one query', function (done) {
            const payload = { query: QUERY };
            this.batchTestClient.createJob(payload, function (err, jobResult, res) {
                assert.ok(!err);

                assert.ok(res.headers['x-sqlapi-log']);
                const log = JSON.parse(res.headers['x-sqlapi-log']);
                assert.deepStrictEqual(log, {
                    request: {
                        sql: {
                            type: TYPES.JOB,
                            sql: QUERY
                        }
                    }
                });

                return done();
            });
        });

        it('Respects max header size with long queries', function (done) {
            let longQuery = "Select '";
            for (let i = 0; i < 7000; i++) {
                longQuery += 'a';
            }
            longQuery += "' as foo";

            const payload = { query: QUERY };
            this.batchTestClient.createJob(payload, function (err, jobResult, res) {
                assert.ok(!err);

                assert.ok(res.headers['x-sqlapi-log']);
                assert.ok(res.headers['x-sqlapi-log'].length < 5000);

                return done();
            });
        });

        it('multiquery job with two queries', function (done) {
            const payload = { query: [QUERY, QUERY] };
            this.batchTestClient.createJob(payload, function (err, jobResult, res) {
                assert.ok(!err);

                assert.ok(res.headers['x-sqlapi-log']);
                const log = JSON.parse(res.headers['x-sqlapi-log']);
                assert.deepStrictEqual(log, {
                    request: {
                        sql: {
                            type: TYPES.JOB,
                            sql: {
                                0: QUERY,
                                1: QUERY
                            }
                        }
                    }
                });

                return done();
            });
        });

        it('Respects max header size with long multiqueries', function (done) {
            let longQuery = "Select '";
            for (let i = 0; i < 100; i++) {
                longQuery += 'a';
            }
            longQuery += "' as foo";

            const queries = [longQuery];
            for (let i = 0; i < 70; i++) {
                queries.push(longQuery);
            }

            const payload = { query: queries };
            this.batchTestClient.createJob(payload, function (err, jobResult, res) {
                assert.ok(!err);

                assert.ok(res.headers['x-sqlapi-log']);
                assert.ok(res.headers['x-sqlapi-log'].length < 5000);

                return done();
            });
        });

        it('Respects max header size with lots of multiqueries', function (done) {
            const queries = [];
            for (let i = 0; i < 1000; i++) {
                queries.push('Select 1');
            }

            const payload = { query: queries };
            this.batchTestClient.createJob(payload, function (err, jobResult, res) {
                assert.ok(!err);

                assert.ok(res.headers['x-sqlapi-log']);
                assert.ok(res.headers['x-sqlapi-log'].length < 5000);

                return done();
            });
        });

        it('queries with fallbacks', function (done) {
            const FALLBACK_QUERY = {
                query: [{
                    query: QUERY,
                    onsuccess: QUERY,
                    onerror: QUERY
                }],
                onsuccess: QUERY,
                onerror: QUERY
            };
            const payload = { query: FALLBACK_QUERY };

            this.batchTestClient.createJob(payload, function (err, jobResult, res) {
                assert.ok(!err);

                assert.ok(res.headers['x-sqlapi-log']);
                const log = JSON.parse(res.headers['x-sqlapi-log']);
                assert.deepStrictEqual(log, {
                    request: {
                        sql: {
                            type: TYPES.JOB,
                            sql: {
                                onsuccess: QUERY,
                                onerror: QUERY,
                                query: {
                                    0: {
                                        query: QUERY,
                                        onsuccess: QUERY,
                                        onerror: QUERY
                                    }
                                }
                            }
                        }
                    }
                });

                return done();
            });
        });
    });

    describe('disable queries log', function () {
        before(function () {
            global.settings.logQueries = false;
        });

        after(function () {
            global.settings.logQueries = true;
        });

        it('GET query', function (done) {
            assert.response(server,
                {
                    method: 'GET',
                    url: '/api/v1/sql?' + qs.stringify({
                        q: QUERY,
                        api_key: API_KEY
                    }),
                    headers: {
                        host: 'vizzuality.cartodb.com'
                    }
                },
                { statusCode: 200 },
                function (err, res) {
                    assert.ok(!err);

                    assert.ok(res.headers['x-sqlapi-log']);
                    const log = JSON.parse(res.headers['x-sqlapi-log']);
                    assert.deepStrictEqual(log, {
                        request: {
                            sql: null
                        }
                    });

                    return done();
                }
            );
        });
    });
});
