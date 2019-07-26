'use strict';

const sanitizeFilename = require('../utils/filename_sanitizer');
const formats = require('../models/formats');

module.exports = function queryParams ({ strategy = 'query' } = {}) {
    let middleware;

    switch (strategy) {
        case('query'):
            middleware = queryParamsMiddleware;
            break;
        case('job'):
            middleware = jobParamsMiddleware;
            break;
        case('copyfrom'):
            middleware = copyFromParamsMiddleware;
            break;
        case('copyto'):
            middleware = copyToParamsMiddleware;
            break;
        default:
            throw new Error('Missig parameter strategy middleware');
    }

    return middleware;
};

function queryParamsMiddleware (req, res, next) {
    const inputParams = Object.assign({}, req.query, req.body || {});
    const params = {};

    params.sql = inputParams.q;

    if (typeof params.sql !== 'string') {
        return next(new Error('You must indicate a sql query'));
    }

    params.orderBy = inputParams.order_by;
    params.sortOrder = inputParams.sort_order;
    params.format = parseFormat(inputParams.format);

    if (!formats.hasOwnProperty(params.format) ) {
        return next(new Error(`Invalid format: ${params.format}`));
    }

    params.skipfields = parseSkipFiles(inputParams.skipfields);
    params.decimalPrecision = inputParams.dp ? inputParams.dp : '6';
    params.filename = parseQueryFilename(inputParams.filename);
    params.limit = parseLimit(inputParams.rows_per_page);
    params.offset = parseOffset(inputParams.page, params.limit);
    params.callback = inputParams.callback;

    res.locals.params = params;

    next();
}

function jobParamsMiddleware (req, res, next) {
    const inputParams = Object.assign({}, req.query, req.body || {});
    const params = {};

    params.sql = inputParams.query;

    res.locals.params = params;

    return next();
}

function copyFromParamsMiddleware (req, res, next) {
    const inputParams = Object.assign({}, req.query, req.body || {});
    const params = {};

    params.sql = inputParams.q;

    if (typeof params.sql !== 'string') {
        return next(new Error('SQL is missing'));
    }

    if (!params.sql .toUpperCase().startsWith('COPY ')) {
        return next(new Error('SQL must start with COPY'));
    }

    res.locals.params = params;

    next();
}

function copyToParamsMiddleware (req, res, next) {
    const inputParams = Object.assign({}, req.query, req.body || {});
    const params = {};

    params.sql = inputParams.q;

    if (typeof params.sql !== 'string') {
        return next(new Error('SQL is missing'));
    }

    if (!params.sql .toUpperCase().startsWith('COPY ')) {
        return next(new Error('SQL must start with COPY'));
    }

    params.filename = inputParams.filename ? inputParams.filename : 'carto-sql-copyto.dmp';

    res.locals.params = params;

    next();
}

function parseQueryFilename (inputFilename) {
    return (inputFilename === '' || inputFilename === undefined) ? 'cartodb-query' : sanitizeFilename(inputFilename);
}

function parseOffset (inputPage, inputLimit) {
    let offset;

    offset = parseInt(inputPage, 10);

    if (Number.isFinite(offset)) {
        offset = offset * inputLimit;
    } else {
        offset = null;
    }

    return offset;
}

function parseLimit (inputLimit) {
    let limit;

    limit = parseInt(inputLimit, 10);

    if (!Number.isFinite(limit)) {
        limit = null;
    }

    return limit;
}

function parseFormat (inputFormat) {
    let format;

    if (Array.isArray(inputFormat)) {
        format = inputFormat[inputFormat.length - 1];
    }

    if (inputFormat === '' || inputFormat === undefined) {
        format = 'json';
    } else if (typeof inputFormat === 'string'){
        format = inputFormat.toLowerCase();
    }

    return format;
}

// Accept both comma-separated string or array of comma-separated strings
function parseSkipFiles (inputSkippedFiles) {
    let skipfields;

    if (!inputSkippedFiles) {
        skipfields = [];
        return skipfields;
    }

    if (typeof inputSkippedFiles === 'string' ) {
        skipfields = inputSkippedFiles.split(',');
        return skipfields;
    }

    if (Array.isArray(inputSkippedFiles) ) {
        skipfields = [];

        inputSkippedFiles.forEach(e => {
            skipfields = skipfields.concat(e.split(','));
        });
    }

    return skipfields;
}
