'use strict';

var assert = require('assert');
var errorHandler = require('../../app/utils/error_handler');

describe('error-handler', function() {
    it('should return a header with errors', function (done) {
        const error = new Error('error test');
        error.detail = 'test detail';
        error.hint = 'test hint';
        error.context = 'test context';

        const res = {
            req: {},
            headers: {},
            set (key, value) {
                this.headers[key] = value;
            },
            header (key, value) {
                this.set(key, value);
            },
            statusCode: 0,
            status (status) {
                this.statusCode = status;
            },
            json () {}
        };

        const errorHeader = {
            detail: error.detail,
            hint: error.hint,
            context: error.context,
            statusCode: 400,
            message: error.message
        };

        errorHandler(error, res);
        
        assert.ok(res.headers['X-SQLAPI-Errors'].length > 0);
        assert.deepEqual(
            res.headers['X-SQLAPI-Errors'], 
            JSON.stringify(errorHeader)
        );

        done();
    });

    it('JSONP should return a header with error statuscode', function (done) {
        const error = new Error('error test');
        error.detail = 'test detail';
        error.hint = 'test hint';
        error.context = 'test context';

        const res = {
            req: { 
                query: { callback: true }
            },
            headers: {},
            set (key, value) {
                this.headers[key] = value;
            },
            header (key, value) {
                this.set(key, value);
            },
            statusCode: 0,
            status (status) {
                this.statusCode = status;
            },
            jsonp () {}
        };

        const errorHeader = {
            detail: error.detail,
            hint: error.hint,
            context: error.context,
            statusCode: 400,
            message: error.message
        };

        errorHandler(error, res);
        
        assert.ok(res.headers['X-SQLAPI-Errors'].length > 0);
        assert.deepEqual(
            res.headers['X-SQLAPI-Errors'], 
            JSON.stringify(errorHeader)
        );

        done();
    });
  
});
