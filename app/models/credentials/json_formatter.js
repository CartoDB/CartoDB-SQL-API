function JsonFormatter(credentials) {
    this.credentials = credentials;
}

module.exports = JsonFormatter;


JsonFormatter.prototype.getCredentials = function() {
    return this.credentials.getRaw();
};

JsonFormatter.prototype.getContentType = function() {
    return 'application/json; charset=utf-8';
};
