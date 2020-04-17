'use strict';

const server = require('../../lib/server')();
const assert = require('../support/assert');
const qs = require('querystring');

describe('cache headers', function () {
    it('should return a Vary header', function (done) {
        assert.response(server, {
            url: `/api/v1/sql?${qs.encode({
                api_key: '1234',
                q: 'select * from untitle_table_4'
            })}`,
            headers: {
                host: 'vizzuality.cartodb.com'
            },
            method: 'GET'
        },
        {},
        function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.headers.vary, 'Authorization');
            done();
        });
    });

    it('should return a proper max-age when CDB_TableMetadata table includes the last updated time', function (done) {
        const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
        const noTtl = 0;
        const fallbackTtl = global.settings.cache.fallbackTtl || 300;
        const ttl = global.settings.cache.ttl || ONE_YEAR_IN_SECONDS;
        const tableName = `wadus_table_${Date.now()}`;

        assert.response(server, {
            url: `/api/v1/sql?${qs.encode({
                api_key: '1234',
                q: `create table ${tableName}()`
            })}`,
            headers: {
                host: 'vizzuality.cartodb.com'
            },
            method: 'GET'
        },
        {},
        function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.headers['cache-control'], `no-cache,max-age=${noTtl},must-revalidate,public`);

            assert.response(server, {
                url: `/api/v1/sql?${qs.encode({
                    api_key: '1234',
                    q: `select * from ${tableName}`
                })}`,
                headers: {
                    host: 'vizzuality.cartodb.com'
                },
                method: 'GET'
            }, {},
            function (err, res) {
                assert.ifError(err);
                const cacheControl = res.headers['cache-control'];
                const [, maxAge] = cacheControl.split(',');
                const [, value] = maxAge.split('=');

                assert.ok(Number(value) <= fallbackTtl);

                assert.response(server, {
                    url: `/api/v1/sql?${qs.encode({
                        api_key: '1234',
                        q: `select cartodb.CDB_TableMetadataTouch('${tableName}'::regclass)`
                    })}`,
                    headers: {
                        host: 'vizzuality.cartodb.com'
                    },
                    method: 'GET'
                }, {},
                function (err, res) {
                    assert.ifError(err);
                    assert.strictEqual(res.headers['cache-control'], `no-cache,max-age=${ttl},must-revalidate,public`);

                    assert.response(server, {
                        url: `/api/v1/sql?${qs.encode({
                            api_key: '1234',
                            q: `select * from ${tableName}`
                        })}`,
                        headers: {
                            host: 'vizzuality.cartodb.com'
                        },
                        method: 'GET'
                    }, {},
                    function (err, res) {
                        assert.ifError(err);
                        assert.strictEqual(res.headers['cache-control'], `no-cache,max-age=${ttl},must-revalidate,public`);
                        done();
                    });
                });
            });
        });
    });

    it('should return a proper max-age when the query doesn\'t use any table', function (done) {
        const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
        const ttl = global.settings.cache.ttl || ONE_YEAR_IN_SECONDS;

        assert.response(server, {
            url: `/api/v1/sql?${qs.encode({
                api_key: '1234',
                q: 'select 1'
            })}`,
            headers: {
                host: 'vizzuality.cartodb.com'
            },
            method: 'GET'
        },
        {},
        function (err, res) {
            assert.ifError(err);
            assert.strictEqual(res.headers['cache-control'], `no-cache,max-age=${ttl},must-revalidate,public`);
            done();
        });
    });
});
