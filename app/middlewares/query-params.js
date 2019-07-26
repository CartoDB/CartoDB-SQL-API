'use strict';

const sanitizeFilename = require('../utils/filename_sanitizer');
const formats = require('../models/formats');

module.exports = function queryParams ({ strategy = 'query' } = {}) {
    const getParams = getParamsFromStrategy(strategy);

    return function queryParamsMiddleware (req, res, next) {
        const inputParams = Object.assign({}, req.query, req.body || {});

        try {
            res.locals.params = getParams(inputParams);
            next();
        } catch (err) {
            next(err);
        }
    };
};

function getParamsFromStrategy (strategy) {
    let fn;

    switch (strategy) {
        case('query'):
            fn = queryParamsStrategy;
            break;
        case('job'):
            fn = jobParamsStrategy;
            break;
        case('copyfrom'):
            fn = copyFromParamsStrategy;
            break;
        case('copyto'):
            fn = copyToParamsStrategy;
            break;
        default:
            throw new Error('Missig parameter strategy');
    }

    return fn;
}

function queryParamsStrategy (inputParams) {
    const params = {};

    params.sql = inputParams.q;

    if (typeof params.sql !== 'string') {
        throw new Error('You must indicate a sql query');
    }

    params.format = parseFormat(inputParams.format);

    if (!formats.hasOwnProperty(params.format) ) {
        throw new Error(`Invalid format: ${params.format}`);
    }

    params.orderBy = inputParams.order_by;
    params.sortOrder = inputParams.sort_order;
    params.skipfields = parseSkipFiles(inputParams.skipfields);
    params.decimalPrecision = inputParams.dp ? inputParams.dp : '6';
    params.filename = parseQueryFilename(inputParams.filename);
    params.limit = parseLimit(inputParams.rows_per_page);
    params.offset = parseOffset(inputParams.page, params.limit);
    params.callback = inputParams.callback;

    return params;
}

function jobParamsStrategy (inputParams) {
    const params = {};

    params.sql = inputParams.query;

    return params;
}

function copyFromParamsStrategy (inputParams) {
    const params = {};

    params.sql = inputParams.q;

    if (typeof params.sql !== 'string') {
        throw new Error('SQL is missing');
    }

    if (!params.sql.toUpperCase().startsWith('COPY ')) {
        throw new Error('SQL must start with COPY');
    }

    return params;
}

function copyToParamsStrategy (inputParams) {
    const params = {};

    params.sql = inputParams.q;

    if (typeof params.sql !== 'string') {
        throw new Error('SQL is missing');
    }

    if (!params.sql .toUpperCase().startsWith('COPY ')) {
        throw new Error('SQL must start with COPY');
    }

    params.filename = inputParams.filename ? inputParams.filename : 'carto-sql-copyto.dmp';

    return params;
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
