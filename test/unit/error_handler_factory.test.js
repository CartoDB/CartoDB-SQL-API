'use strict';

const assert = require('assert');
const errorHandlerFactory = require('../../app/services/error_handler_factory');
const ErrorHandler = require('../../app/services/error_handler');
const { codeToCondition } = require('../../app/postgresql/error_codes');

let rateLimitError = new Error(
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
            const expectedError = new ErrorHandler(
                error.message,
                error.context,
                error.detail,
                error.hint,
                error.http_status,
                codeToCondition[error.code] || error.name
            );

            assert.deepEqual(errorHandler, expectedError);
        });
    });

    it('timeout error', function() {
        const error = new Error('statement timeout');
        const errorHandler = errorHandlerFactory(error);
        const expectedError = new ErrorHandler(
            'You are over platform\'s limits. Please contact us to know more details',
            'limit',
            'datasource',
            undefined,
            429
        );

        assert.deepEqual(errorHandler, expectedError);
    });

    it('permission denied error', function() {
        const error = new Error('permission denied');
        const errorHandler = errorHandlerFactory(error);
        const expectedError = new ErrorHandler(
            error.message,
            error.context,
            error.detail,
            error.hint,
            403,
            codeToCondition[error.code] || error.name
        );

        assert.deepEqual(errorHandler, expectedError);
    });
});
