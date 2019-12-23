'use strict';

module.exports = {
    /**
     * Remove problematic nested characters
     * from object for logs RegEx
     *
     * @param {Object} object
     * @param {Number} max_string_length
     */
    stringifyForLogs (object, max_string_length = 1024) {
        return JSON.stringify(cloneAndFilter(object, max_string_length));
    }
};

function cloneAndFilter (object, max_string_length) {
    if (!object || !(object instanceof Object)) {
        return null;
    }

    const newObject = {};

    Object.keys(object).map(key => {
        if (typeof object[key] === 'string') {
            newObject[key] = filterString(object[key], max_string_length);
        } else if (typeof object[key] === 'object') {
            newObject[key] = cloneAndFilter(object[key], max_string_length);
        } else if (object[key] instanceof Array) {
            newObject[key] = [];
            for (const element of object[key]) {
                newObject[key].push(cloneAndFilter(element, max_string_length));
            }
        } else {
            newObject[key] = object[key];
        }
    });

    return newObject;
}

function filterString (s, max_string_length) {
    return s
        .substring(0, max_string_length)
        .replace(/[^a-zA-Z0-9]/g, ' ');
}
