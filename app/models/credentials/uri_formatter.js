var _ = require('underscore');

function UriFormatter(credentials) {
    this.credentials = credentials;
}

module.exports = UriFormatter;

var format = _.template(
    'postgresql://<%= user %>:<%= password %>@<%= host %>:<%= port %>/<%= dbname %>'
);


UriFormatter.prototype.getCredentials = function() {
    return format(this.credentials.getRaw());
};

UriFormatter.prototype.getContentType = function() {
    return 'text/plain';
};
