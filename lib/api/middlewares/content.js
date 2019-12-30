'use strict';

const getContentDisposition = require('../../utils/content-disposition');

module.exports = function content () {
    return function contentMiddleware (req, res, next) {
        const { filename } = res.locals.params;
        const { formatter } = req;
        const useInline = !req.query.format && !req.body.format && !req.query.filename && !req.body.filename;

        res.header('Content-Disposition', getContentDisposition(formatter, filename, useInline));
        res.header('Content-Type', formatter.getContentType());

        next();
    };
};
