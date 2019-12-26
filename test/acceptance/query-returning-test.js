'use strict';

require('../helper');

var server = require('../../lib/server')();
var assert = require('../support/assert');
var querystring = require('querystring');
var _ = require('underscore');

describe('query-returning', function () {
    var RESPONSE_OK = {
        statusCode: 200
    };

    var expectedRwCacheControl = 'no-cache,max-age=0,must-revalidate,public';

    // Check results from INSERT
    //
    // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/13
    it('INSERT returns affected rows', function (done) {
        assert.response(server, {
            // view prepare_db.sh to see where to set api_key
            url: '/api/v1/sql?api_key=1234&' + querystring.stringify({
                q:
            "INSERT INTO private_table(name) VALUES('noret1') UNION VALUES('noret2')"
            }),
            headers: { host: 'vizzuality.localhost.lan:8080' },
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            var out = JSON.parse(res.body);
            assert.ok(Object.prototype.hasOwnProperty.call(out, 'time'));
            assert.strictEqual(out.total_rows, 2);
            assert.strictEqual(out.rows.length, 0);
            // Check cache headers
            // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
            assert.ok(!Object.prototype.hasOwnProperty.call(res, 'x-cache-channel'));
            assert.strictEqual(res.headers['cache-control'], expectedRwCacheControl);
            done();
        });
    });

    // Check results from UPDATE
    //
    // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/13
    it('UPDATE returns affected rows', function (done) {
        assert.response(server, {
            // view prepare_db.sh to see where to set api_key
            url: '/api/v1/sql?api_key=1234&' + querystring.stringify({
                q:
            "UPDATE private_table SET name = upper(name) WHERE name in ('noret1', 'noret2')"
            }),
            headers: { host: 'vizzuality.localhost.lan:8080' },
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            var out = JSON.parse(res.body);
            assert.ok(Object.prototype.hasOwnProperty.call(out, 'time'));
            assert.strictEqual(out.total_rows, 2);
            assert.strictEqual(out.rows.length, 0);
            // Check cache headers
            // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
            assert.ok(!Object.prototype.hasOwnProperty.call(res, 'x-cache-channel'));
            assert.strictEqual(res.headers['cache-control'], expectedRwCacheControl);
            done();
        });
    });

    // Check results from DELETE
    //
    // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/13
    it('DELETE returns affected rows', function (done) {
        assert.response(server, {
            // view prepare_db.sh to see where to set api_key
            url: '/api/v1/sql?api_key=1234&' + querystring.stringify({
                q:
            "DELETE FROM private_table WHERE name in ('NORET1', 'NORET2')"
            }),
            headers: { host: 'vizzuality.localhost.lan:8080' },
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            var out = JSON.parse(res.body);
            assert.ok(Object.prototype.hasOwnProperty.call(out, 'time'));
            assert.strictEqual(out.total_rows, 2);
            assert.strictEqual(out.rows.length, 0);
            // Check cache headers
            // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/43
            assert.ok(!Object.prototype.hasOwnProperty.call(res, 'x-cache-channel'));
            assert.strictEqual(res.headers['cache-control'], expectedRwCacheControl);
            done();
        });
    });

    // Check results from INSERT .. RETURNING
    //
    // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/50
    it('INSERT with RETURNING returns all results', function (done) {
        assert.response(server, {
            // view prepare_db.sh to see where to set api_key
            url: '/api/v1/sql?api_key=1234&' + querystring.stringify({
                q:
            "INSERT INTO private_table(name) VALUES('test') RETURNING upper(name), reverse(name)"
            }),
            headers: { host: 'vizzuality.localhost.lan:8080' },
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            var out = JSON.parse(res.body);
            assert.ok(Object.prototype.hasOwnProperty.call(out, 'time'));
            assert.strictEqual(out.total_rows, 1);
            assert.strictEqual(out.rows.length, 1);
            assert.strictEqual(_.keys(out.rows[0]).length, 2);
            assert.strictEqual(out.rows[0].upper, 'TEST');
            assert.strictEqual(out.rows[0].reverse, 'tset');
            done();
        });
    });

    // Check results from UPDATE .. RETURNING
    //
    // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/50
    it('UPDATE with RETURNING returns all results', function (done) {
        assert.response(server, {
            // view prepare_db.sh to see where to set api_key
            url: '/api/v1/sql?api_key=1234&' + querystring.stringify({
                q:
            "UPDATE private_table SET name = 'tost' WHERE name = 'test' RETURNING upper(name), reverse(name)"
            }),
            headers: { host: 'vizzuality.localhost.lan:8080' },
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            var out = JSON.parse(res.body);
            assert.ok(Object.prototype.hasOwnProperty.call(out, 'time'));
            assert.strictEqual(out.total_rows, 1);
            assert.strictEqual(out.rows.length, 1);
            assert.strictEqual(_.keys(out.rows[0]).length, 2);
            assert.strictEqual(out.rows[0].upper, 'TOST');
            assert.strictEqual(out.rows[0].reverse, 'tsot');
            done();
        });
    });

    // Check results from DELETE .. RETURNING
    //
    // See https://github.com/Vizzuality/CartoDB-SQL-API/issues/50
    it('DELETE with RETURNING returns all results', function (done) {
        assert.response(server, {
            // view prepare_db.sh to see where to set api_key
            url: '/api/v1/sql?api_key=1234&' + querystring.stringify({
                q:
            "DELETE FROM private_table WHERE name = 'tost' RETURNING name"
            }),
            headers: { host: 'vizzuality.localhost.lan:8080' },
            method: 'GET'
        }, RESPONSE_OK, function (err, res) {
            assert.ifError(err);
            var out = JSON.parse(res.body);
            assert.ok(Object.prototype.hasOwnProperty.call(out, 'time'));
            assert.strictEqual(out.total_rows, 1);
            assert.strictEqual(out.rows.length, 1);
            assert.strictEqual(_.keys(out.rows[0]).length, 1);
            assert.strictEqual(out.rows[0].name, 'tost');
            done();
        });
    });
});
