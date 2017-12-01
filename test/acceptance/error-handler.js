var server = require('../../app/server')();
var assert = require('../support/assert');

describe('error handler', function () { 
    it('should returns a errors header', function (done) {
        const errorHeader = {
            detail: undefined,
            hint: undefined,
            context: undefined,
            statusCode: 400,
            message: 'You must indicate a sql query'
        };

        assert.response(server, {
            url: '/api/v1/sql',
            headers: {host: 'vizzuality.cartodb.com'},
            method: 'GET'
        },
        {
            status: 400,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-SQLAPI-Errors': JSON.stringify(errorHeader)
            }
        }, 
        function(err){
            assert.ifError(err);
            done();
        });
    });
});