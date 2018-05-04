require('../helper');

var server = require('../../app/server')();
var assert = require('../support/assert');
var querystring = require('querystring');

describe('query-multipart', function() {
    it('multipart form select', function(done){
        assert.response(server, {
            url: '/api/v1/sql',
            formData: {
                q: 'SELECT 2 as n'
            },
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'POST'
        },{}, function(err, res) {
            assert.ifError(err);
            const response = JSON.parse(res.body);
            assert.equal(!!response.time, true);
            assert.strictEqual(response.total_rows, 1);
            assert.deepStrictEqual(response.rows, [{n:2}]);
            done();
        });
    });
});
