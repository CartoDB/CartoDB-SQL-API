'use const';

var server = require('../../app/server')();
const assert = require('../support/assert');

describe('Cache', function () {
    it('should return a Vary header', function (done) {
        assert.response(server, {
            url: '/api/v1/sql?api_key=1234&g=select%20*%20from%20untitle_table_4',
            headers: {
                host: 'vizzuality.cartodb.com'
            },
            method: 'GET'
        },
        {},
        function(err, res) {
            assert.equal(res.headers.vary, 'Authorization');
            done();
        });
    });
});
