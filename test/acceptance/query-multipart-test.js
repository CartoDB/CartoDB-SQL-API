'use strict';

require('../helper');

const server = require('../../lib/server')();
const assert = require('../support/assert');

describe('query-multipart', function () {
    it('make query from a multipart form', function (done) {
        assert.response(server, {
            url: '/api/v1/sql',
            formData: {
                q: 'SELECT 2 as n'
            },
            headers: { host: 'vizzuality.cartodb.com' },
            method: 'POST'
        }, {}, function (err, res) {
            assert.ifError(err);
            const response = JSON.parse(res.body);
            assert.strictEqual(typeof (response.time) !== 'undefined', true);
            assert.strictEqual(response.total_rows, 1);
            assert.deepStrictEqual(response.rows, [{ n: 2 }]);
            done();
        });
    });
});
