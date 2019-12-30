'use strict';

module.exports = function getContentDisposition (formatter, filename, inline) {
    var ext = formatter.getFileExtension();
    var time = new Date().toUTCString();
    return (inline ? 'inline' : 'attachment') + '; filename=' + filename + '.' + ext + '; ' +
        'modification-date="' + time + '";';
};
