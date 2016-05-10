'use strict';

module.exports.isSimple = isSimple;
module.exports.isMultiple = isMultiple;
module.exports.isFallback = isFallback;
module.exports.isFallbackNode = isFallbackNode;

function isSimple(query) {
    return isString(query);
}

function isString(value) {
    return typeof value === 'string';
}

function isMultiple(multiple) {
    return isArray(multiple);
}

function isArray(value) {
    return Array.isArray(value);
}

function isFallback(fallback) {
    if (!isObject(fallback)) {
        return false;
    }
    if (!isMultiple(fallback.query)) {
        return false;
    }

    if (fallback.onsuccess && !isSimple(fallback.onsuccess)) {
        return false;
    }

    if (fallback.onerror && !isSimple(fallback.onerror)) {
        return false;
    }

    return true;
}

function isFallbackNode(fallbackNode) {
    if (!isObject(fallbackNode)) {
        return false;
    }

    if (!isSimple(fallbackNode.query)) {
        return false;
    }

    if (fallbackNode.onsuccess && !isSimple(fallbackNode.onsuccess)) {
        return false;
    }

    if (fallbackNode.onerror && !isSimple(fallbackNode.onerror)) {
        return false;
    }

    return true;
}

function isObject(value) {
    var type = typeof value;
    return !!value && (type ==='object' || type === 'function');
}
