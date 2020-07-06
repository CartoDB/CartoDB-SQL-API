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
        const serialized = {
            error: [this.message],
            context: this.context,
            detail: this.detail,
            hint: this.hint
        };

        if (global.settings.environment === 'development') {
            serialized.stack = this.stack;
        }

        return serialized;
    }

    getHttpStatus (httpStatus = 400) {
        if (this.message.includes('permission denied')) {
            return 403;
        }

        return httpStatus;
    }
}

module.exports = ErrorHandler;
