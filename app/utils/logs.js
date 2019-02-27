'use strict';

module.exports = {
    /**
     * Remove problematic nested characters
     * from object for logs RegEx
     *
     * @param {Object} object
     * @param {Number} max_string_length
     */
    stringifyForLogs(object, max_string_length = 1024) {
        return doStringifyForLogs(object, max_string_length);
    }
}

function doStringifyForLogs(object, max_string_length) {
    Object.keys(object).map(key => {
        if (typeof object[key] === 'string') {
            object[key] = filterString(object[key], max_string_length)
        } else if (typeof object[key] === 'object') {
            doStringifyForLogs(object[key], max_string_length);
        } else if (object[key] instanceof Array) {
            for (let element of object[key]) {
                doStringifyForLogs(element, max_string_length);
            }
        }
    });

    return JSON.stringify(object);
}

function filterString(s, max_string_length) {
    return s
        .substring(0, max_string_length)
        .replace(/[^a-zA-Z0-9]/g, ' ');
}
