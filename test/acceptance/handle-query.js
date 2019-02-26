'use strict';

require('../helper');

const server = require('../../app/server')();
const assert = require('../support/assert');
const qs = require('querystring');

const QUERY = `SELECT 14 as foo`;
const API_KEY = 1234;

describe.only('Handle query middleware', function() {
    ['GET', 'POST'].forEach(method => {
        it(`${method} without query fails`, function(done) {
            assert.response(server,
                {
                    method,
                    url: '/api/v1/sql?' + qs.stringify({
                        api_key: API_KEY
                    }),
                    headers: {
                        host: 'vizzuality.cartodb.com'
                    }
                },
                { statusCode: 400 },
                function(err, res) {
                    assert.ok(!err);

                    const response = JSON.parse(res.body);
                    assert.deepEqual(response, { error: ["You must indicate a sql query"] });

                    done();
                }
            );
        });

        it(`${method} query`, function(done) {
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
                function(err, res) {
                    assert.ok(!err);

                    const response = JSON.parse(res.body);
                    assert.equal(response.rows.length, 1);
                    assert.equal(response.rows[0].foo, 14);

                    done();
                }
            );
        });
    });
});
