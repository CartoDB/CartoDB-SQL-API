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
}

module.exports = ErrorHandler;
