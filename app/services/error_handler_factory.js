const ErrorHandler = require('./error_handler');
const pgErrorCodes = require('../postgresql/error_codes');

module.exports = function ErrorHandlerFactory () {
    if (isTimeoutError(err)) {
        return createTimeoutError();
    } else {
        return createGenericError(err);
    }
};

function isTimeoutError(err) {
    return err.message && (
        err.message.indexOf('statement timeout') > -1 ||
        err.message.indexOf('RuntimeError: Execution of function interrupted by signal') > -1
    );
}

function createTimeoutError() {
    return new ErrorHandler(
        'You are over platform\'s limits. Please contact us to know more details',
        'limit',
        'datasource',
        undefined,
        429
    );
}

function createGenericError(err) {
    return new ErrorHandler(
        err.message,
        err.context,
        err.detail,
        err.hint,
        err.http_status,
        pgErrorCodes.codeToCondition[err.code] || err.name
    );
}
