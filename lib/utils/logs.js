'use strict';

module.exports = {
    /**
     * Remove problematic nested characters
     * from object for logs RegEx
     *
     * @param {Object} object
     * @param {Number} maxStringLength
     */
    stringifyForLogs (object, maxStringLength = 1024) {
        return JSON.stringify(cloneAndFilter(object, maxStringLength));
    }
};

function cloneAndFilter (object, maxStringLength) {
    if (!object || !(object instanceof Object)) {
        return null;
    }

    const newObject = {};

    Object.keys(object).map(key => {
        if (typeof object[key] === 'string') {
            newObject[key] = filterString(object[key], maxStringLength);
        } else if (typeof object[key] === 'object') {
            newObject[key] = cloneAndFilter(object[key], maxStringLength);
        } else if (object[key] instanceof Array) {
            newObject[key] = [];
            for (const element of object[key]) {
                newObject[key].push(cloneAndFilter(element, maxStringLength));
            }
        } else {
            newObject[key] = object[key];
        }
    });

    return newObject;
}

function filterString (s, maxStringLength) {
    return s
        .substring(0, maxStringLength)
        .replace(/[^a-zA-Z0-9]/g, ' ');
}
