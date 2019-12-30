'use strict';

const sanitizeFilename = require('../../utils/filename-sanitizer');
const formats = require('../../models/formats');

module.exports = function params ({ strategy = 'query' } = {}) {
    const getParams = getParamsFromStrategy(strategy);

    return function paramsMiddleware (req, res, next) {
        const input = Object.assign({}, req.query, req.body);

        try {
            res.locals.params = getParams(input);
            next();
        } catch (err) {
            next(err);
        }
    };
};

function getParamsFromStrategy (strategy) {
    let fn;

    switch (strategy) {
    case ('query'):
        fn = queryParamsStrategy;
        break;
    case ('job'):
        fn = jobParamsStrategy;
        break;
    case ('copyfrom'):
        fn = copyFromParamsStrategy;
        break;
    case ('copyto'):
        fn = copyToParamsStrategy;
        break;
    default:
        throw new Error('Missig parameter strategy');
    }

    return fn;
}

function queryParamsStrategy (input) {
    const params = {};

    params.sql = input.q;

    if (typeof params.sql !== 'string') {
        throw new Error('You must indicate a sql query');
    }

    params.format = parseFormat(input.format);

    if (!Object.prototype.hasOwnProperty.call(formats, params.format)) {
        throw new Error(`Invalid format: ${params.format}`);
    }

    params.orderBy = input.order_by;
    params.sortOrder = input.sort_order;
    params.skipfields = parseSkipFiles(input.skipfields);
    params.decimalPrecision = input.dp ? input.dp : '6';
    params.filename = parseQueryFilename(input.filename);
    params.limit = parseLimit(input.rows_per_page);
    params.offset = parseOffset(input.page, params.limit);
    params.callback = input.callback;
    params.cachePolicy = input.cache_policy;

    return params;
}

function jobParamsStrategy (input) {
    const params = {};

    params.sql = input.query;

    return params;
}

function copyFromParamsStrategy (input) {
    const params = {};

    params.sql = input.q;

    if (typeof params.sql !== 'string') {
        throw new Error('SQL is missing');
    }

    if (!params.sql.toUpperCase().startsWith('COPY ')) {
        throw new Error('SQL must start with COPY');
    }

    return params;
}

function copyToParamsStrategy (input) {
    const params = {};

    params.sql = input.q;

    if (typeof params.sql !== 'string') {
        throw new Error('SQL is missing');
    }

    if (!params.sql.toUpperCase().startsWith('COPY ')) {
        throw new Error('SQL must start with COPY');
    }

    params.filename = input.filename ? input.filename : 'carto-sql-copyto.dmp';

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
    } else if (typeof inputFormat === 'string') {
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

    if (typeof inputSkippedFiles === 'string') {
        skipfields = inputSkippedFiles.split(',');
        return skipfields;
    }

    if (Array.isArray(inputSkippedFiles)) {
        skipfields = [];

        inputSkippedFiles.forEach(e => {
            skipfields = skipfields.concat(e.split(','));
        });
    }

    return skipfields;
}
