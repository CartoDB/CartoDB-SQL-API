'use strict';

const ErrorHandler = require('./error-handler');
const { codeToCondition } = require('../postgresql/error-codes');

module.exports = function ErrorHandlerFactory (err) {
    if (isTimeoutError(err)) {
        return createTimeoutError();
    } else {
        return createGenericError(err);
    }
};

function isTimeoutError (err) {
    return err.message && (
        err.message.indexOf('statement timeout') > -1 ||
        err.message.indexOf('RuntimeError: Execution of function interrupted by signal') > -1 ||
        err.message.indexOf('canceling statement due to user request') > -1
    );
}

function createTimeoutError () {
    return new ErrorHandler({
        message: 'You are over platform\'s limits: SQL query timeout error.' +
                 ' Refactor your query before running again or contact CARTO support for more details.',
        context: 'limit',
        detail: 'datasource',
        httpStatus: 429
    });
}

function createGenericError (err) {
    return new ErrorHandler({
        message: err.message,
        context: err.context,
        detail: err.detail,
        hint: err.hint,
        httpStatus: err.http_status,
        name: codeToCondition[err.code] || err.name
    });
}
