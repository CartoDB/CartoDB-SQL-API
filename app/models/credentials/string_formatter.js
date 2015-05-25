var _ = require('underscore');

function StringFormatter(credentials) {
    this.credentials = credentials;
}

module.exports = StringFormatter;

var format = _.template(
    'host=<%= host %> port=<%= port %> user=<%= user %> password=<%= password %> dbname=<%= dbname %>'
);


StringFormatter.prototype.getCredentials = function() {
    return format(this.credentials.getRaw());
};

StringFormatter.prototype.getContentType = function() {
    return 'text/plain';
};
