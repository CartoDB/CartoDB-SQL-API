const ErrorHandler = require('./error_handler');
const { codeToCondition } = require('../postgresql/error_codes');

module.exports = function ErrorHandlerFactory (err) {
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
    return new ErrorHandler({
        message: `You are over platform\'s limits. Please contact us to know more details. 
                  SQL query timeout expired error.`,
        context: 'limit',
        detail: 'datasource',
        http_status: 429
    });
}

function createGenericError(err) {
    return new ErrorHandler({
        message: err.message,
        context: err.context,
        detail: err.detail,
        hint: err.hint,
        http_status: err.http_status,
        name: codeToCondition[err.code] || err.name
    });
}
