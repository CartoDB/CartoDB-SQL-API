var pgErrorCodes = require('./error_codes');

class ErrorHandler extends Error {
    constructor(message, http_status, context, detail, hint, name = null) {
        super(message);
        this.http_status = http_status;
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

    static getName (err) {
        return pgErrorCodes.codeToCondition[err.code] || err.name;
    }
    
    static getStatus (err) {
        var statusError = err.http_status || 400;
    
        if (err.message && err.message.match(/permission denied/)) {
            statusError = 403;
        }
    
        return statusError;
    }
}

module.exports = ErrorHandler;
