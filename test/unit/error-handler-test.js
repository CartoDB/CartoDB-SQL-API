'use strict';

var assert = require('assert');
var errorMiddleware = require('../../lib/api/middlewares/error');
require('../helper');

const req = { query: { callback: true } };

const getRes = () => {
    return {
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
        json () {},
        jsonp () {}
    };
};

const getErrorHeader = (context, detail, hint, message) => {
    return {
        context,
        detail,
        hint,
        statusCode: 400,
        message
    };
};

describe('error-handler', function () {
    it('should return a header with errors', function (done) {
        const error = new Error('error test');
        error.detail = 'test detail';
        error.hint = 'test hint';
        error.context = 'test context';

        const errorHeader = getErrorHeader(
            error.context,
            error.detail,
            error.hint,
            error.message
        );

        const res = getRes();

        errorMiddleware()(error, req, res, function next () {
            assert.ok(res.headers['X-SQLAPI-Errors'].length > 0);
            assert.deepStrictEqual(
                res.headers['X-SQLAPI-Errors'],
                JSON.stringify(errorHeader)
            );

            done();
        });
    });

    it('JSONP should return a header with error statuscode', function (done) {
        const error = new Error('error test');
        error.detail = 'test detail';
        error.hint = 'test hint';
        error.context = 'test context';

        const errorHeader = getErrorHeader(
            error.context,
            error.detail,
            error.hint,
            error.message
        );

        const res = getRes();

        errorMiddleware()(error, req, res, function next () {
            assert.ok(res.headers['X-SQLAPI-Errors'].length > 0);
            assert.deepStrictEqual(
                res.headers['X-SQLAPI-Errors'],
                JSON.stringify(errorHeader)
            );

            done();
        });
    });

    it('should escape chars that broke logs regex', function (done) {
        const badString = 'error: ( ) = " " \' * $ & |';
        const escapedString = 'error                     ';

        const error = new Error(badString);
        error.detail = badString;
        error.hint = badString;
        error.context = badString;

        const errorHeader = getErrorHeader(
            escapedString,
            escapedString,
            escapedString,
            escapedString
        );

        const res = getRes();

        errorMiddleware()(error, req, res, function () {
            assert.ok(res.headers['X-SQLAPI-Errors'].length > 0);
            assert.deepStrictEqual(
                res.headers['X-SQLAPI-Errors'],
                JSON.stringify(errorHeader)
            );

            done();
        });
    });

    it('should truncat too long error messages', function (done) {
        const veryLongString = 'Very long error message '.repeat(1000);
        const truncatedString = veryLongString.substring(0, 1024);

        const error = new Error(veryLongString);

        const expectedErrorHeader = {
            statusCode: 400,
            message: truncatedString
        };

        const res = getRes();

        errorMiddleware()(error, req, res, function () {
            assert.ok(res.headers['X-SQLAPI-Errors'].length > 0);
            assert.deepStrictEqual(
                res.headers['X-SQLAPI-Errors'],
                JSON.stringify(expectedErrorHeader)
            );

            done();
        });
    });
});
