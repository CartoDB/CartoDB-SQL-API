'use strict';

const assert = require('assert');
const errorHandlerFactory = require('../../lib/services/error-handler-factory');
const ErrorHandler = require('../../lib/services/error-handler');
const { codeToCondition } = require('../../lib/postgresql/error-codes');

const rateLimitError = new Error(
    'You are over platform\'s limits. Please contact us to know more details'
);
rateLimitError.http_status = 429;
rateLimitError.context = 'limit';
rateLimitError.detail = 'rate-limit';

const cases = [
    {
        title: 'postgres error',
        error: new Error(codeToCondition['02000'])
    },
    {
        title: 'rate limit error',
        error: rateLimitError
    }
];

describe('error-handler-factory', function () {
    cases.forEach(({ title, error }) => {
        it(title, function () {
            const errorHandler = errorHandlerFactory(error);
            const expectedError = new ErrorHandler({
                message: error.message,
                context: error.context,
                detail: error.detail,
                hint: error.hint,
                httpStatus: error.http_status,
                name: codeToCondition[error.code] || error.name
            });

            assert.deepStrictEqual(errorHandler, expectedError);
        });
    });

    it('timeout error', function () {
        const error = new Error('statement timeout');
        const errorHandler = errorHandlerFactory(error);
        const expectedError = new ErrorHandler({
            message: 'You are over platform\'s limits: SQL query timeout error.' +
                ' Refactor your query before running again or contact CARTO support for more details.',
            context: 'limit',
            detail: 'datasource',
            httpStatus: 429
        });

        assert.deepStrictEqual(errorHandler, expectedError);
    });

    it('permission denied error', function () {
        const error = new Error('permission denied');
        const errorHandler = errorHandlerFactory(error);
        const expectedError = new ErrorHandler({
            message: error.message,
            context: error.context,
            detail: error.detail,
            hint: error.hint,
            httpStatus: 403,
            name: codeToCondition[error.code] || error.name
        });

        assert.deepStrictEqual(errorHandler, expectedError);
    });
});
