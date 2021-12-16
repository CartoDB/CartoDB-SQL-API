'use strict';

const formats = require('../../models/formats');

module.exports = function formatter () {
    return function formatterMiddleware (req, res, next) {
        const { format } = res.locals.params;

        const FormatClass = formats[format];
        req.formatter = new FormatClass();

        next();
    };
};
