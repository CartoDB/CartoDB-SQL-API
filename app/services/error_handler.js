const pgErrorCodes = require('../postgresql/error_codes');

class ErrorHandler extends Error {
    constructor(message, context, detail, hint, http_status = 400, name = null) {
        super(message);

        this.http_status = this.getHttpStatus(http_status);
        this.context = context;
        this.detail = detail;
        this.hint = hint;

        if (name) {
            this.name = name;
        }
    }

    getResponse () {
        return {
            error: [this.message],
            context: this.context,
            detail: this.detail,
            hint: this.hint
        };
    }
    
    getHttpStatus (http_status) {
        if (this.message.includes('permission denied')) {
            return 403;
        }
    
        return http_status;
    }

    static getErrorHandler (err) {
        if (this.isTimeoutError(err)) {
            return this.createTimeoutError();
        } else {
            return this.createGenericError(err);
        }
    }
    
    static isTimeoutError(err) {
        return err.message && (
            err.message.indexOf('statement timeout') > -1 ||
            err.message.indexOf('RuntimeError: Execution of function interrupted by signal') > -1
        );
    }
    
    static createTimeoutError() {
        return new ErrorHandler(
            'You are over platform\'s limits. Please contact us to know more details',
            'limit',
            'datasource',
            undefined,
            429
        );
    }
    
    static createGenericError(err) {
        return new ErrorHandler(
            err.message,
            err.context, 
            err.detail, 
            err.hint, 
            err.http_status, 
            pgErrorCodes.codeToCondition[err.code] || err.name
        );
    }
}

module.exports = ErrorHandler;
