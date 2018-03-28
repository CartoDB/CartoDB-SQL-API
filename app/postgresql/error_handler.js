var pgErrorCodes = require('./error_codes');

class ErrorHandler extends Error {
    constructor(err) {
        super();
        this.err = err;
    
        if (this.isTimeoutError()) {
            this.err = new Error('You are over platform\'s limits. Please contact us to know more details');
            this.err.http_status = 429;
            this.err.context = 'limit';
            this.err.detail = 'datasource';
        }
    }

    getName () {
        return pgErrorCodes.codeToCondition[this.err.code] || this.err.name;
    }
    
    getMessage () {
        return this.err.message;
    }
    
    getFields () {
        return {
            detail: this.err.detail,
            hint: this.err.hint,
            context: this.err.context,
        };
    }
    
    getStatus () {
        var statusError = this.err.http_status || 400;
    
        var message = this.getMessage();
    
        if (message && message.match(/permission denied/)) {
            statusError = 403;
        }
    
        return statusError;
    }
    
    isTimeoutError () {
        return this.err.message && (
            this.err.message.indexOf('statement timeout') > -1 ||
            this.err.message.indexOf('RuntimeError: Execution of function interrupted by signal') > -1
        );
    }
}

module.exports = ErrorHandler;
