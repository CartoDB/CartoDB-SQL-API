'use strict';

var assert = require('assert');
var errorMiddleware = require('../../app/middlewares/error');

describe('error-handler', function() {
    it('should return a header with errors', function (done) {

        let error = new Error('error test');
        error.detail = 'test detail';
        error.hint = 'test hint';
        error.context = 'test context';

        const req = {};
        const res = {
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

        errorMiddleware()(error, req, res, function next () {
            assert.ok(res.headers['X-SQLAPI-Errors'].length > 0);
            assert.deepEqual(
                res.headers['X-SQLAPI-Errors'],
                JSON.stringify(errorHeader)
            );

            done();
        });
    });

    it('JSONP should return a header with error statuscode', function (done) {
        let error = new Error('error test');
        error.detail = 'test detail';
        error.hint = 'test hint';
        error.context = 'test context';

        const req = {
            query: { callback: true }
        };
        const res = {
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

        errorMiddleware()(error, req, res, function next () {
            assert.ok(res.headers['X-SQLAPI-Errors'].length > 0);
            assert.deepEqual(
                res.headers['X-SQLAPI-Errors'],
                JSON.stringify(errorHeader)
            );

            done();
        });
    });

    it('should escape chars that broke logs regex', function (done) {
        const badString = 'error: ( ) = " \" \' * $ & |';
        const escapedString = 'error                     ';

        let error = new Error(badString);
        error.detail = badString;
        error.hint = badString;
        error.context = badString;

        const req = {
            query: { callback: true }
        };
        const res = {
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
            detail: escapedString,
            hint: escapedString,
            context: escapedString,
            statusCode: 400,
            message: escapedString
        };

        errorMiddleware()(error, req, res, function () {
            assert.ok(res.headers['X-SQLAPI-Errors'].length > 0);
            assert.deepEqual(
                res.headers['X-SQLAPI-Errors'],
                JSON.stringify(errorHeader)
            );

            done();
        });
    });
});
