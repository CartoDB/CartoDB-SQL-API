'use strict';

class ErrorHandler extends Error {
    constructor ({ message, context, detail, hint, httpStatus, name }) {
        super(message);

        this.http_status = this.getHttpStatus(httpStatus);
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

    getHttpStatus (httpStatus = 400) {
        if (this.message.includes('permission denied')) {
            return 403;
        }

        return httpStatus;
    }
}

module.exports = ErrorHandler;
