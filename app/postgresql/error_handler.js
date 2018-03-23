var pgErrorCodes = require('./error_codes');

function ErrorHandler(err) {
    this.err = err;

    if(this.isTimeoutError()) {
        this.err = new Error('You are over platform\'s limits. Please contact us to know more details');
        this.err.http_status = 429;
    }
}

module.exports = ErrorHandler;

ErrorHandler.prototype.getName = function() {
    return pgErrorCodes.codeToCondition[this.err.code] || this.err.name;
};

ErrorHandler.prototype.getMessage = function() {
    return this.err.message;
};

ErrorHandler.prototype.getFields = function(fields) {
    fields = fields || ['detail', 'hint', 'context'];
    return fields.reduce(function (previousValue, current) {
        previousValue[current] = this.err[current];
        return previousValue;
    }.bind(this), {});
};

ErrorHandler.prototype.getStatus = function() {
    var statusError = this.err.http_status || 400;

    var message = this.getMessage();

    if (message && message.match(/permission denied/)) {
        statusError = 403;
    }

    return statusError;
};

ErrorHandler.prototype.isTimeoutError = function() {
    return this.err.message && (
        this.err.message.indexOf('statement timeout') > -1 ||
        this.err.message.indexOf('RuntimeError: Execution of function interrupted by signal') > -1
    );
};
