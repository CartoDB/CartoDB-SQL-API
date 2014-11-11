var pgErrorCodes = require('./error_codes');

function ErrorHandler(err) {
    this.err = err;
}

module.exports = ErrorHandler;

ErrorHandler.prototype.getName = function() {
    return pgErrorCodes.codeToCondition[this.err.code] || this.err.name;
};

ErrorHandler.prototype.getMessage = function() {
    var message = this.err.message;

    // `57014: query_canceled` includes other queries than `statement timeout`, otherwise we could do something more
    // straightforward like:
    // return conditionToMessage[this.err.code] || this.err.message;
    if (message && message.match(/statement timeout/)) {
        message = conditionToMessage[pgErrorCodes.conditionToCode.query_canceled];
    }

    return message;
};

ErrorHandler.prototype.getStatus = function() {
    var statusError = this.err.http_status || 400;

    var message = this.getMessage();

    if (message && message.match(/permission denied/)) {
        statusError = 401;
    }

    return statusError;
};

var conditionToMessage = {};
conditionToMessage[pgErrorCodes.conditionToCode.query_canceled] = [
    "Your query was not able to finish.",
    "Either you have too many queries running or the one you are trying to run is too expensive.",
    "Try again."
].join(' ');
