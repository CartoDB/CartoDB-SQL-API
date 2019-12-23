'use strict';

const pgEntitiesAccessValidator = require('../../services/pg-entities-access-validator');

module.exports = function accessValidator () {
    return function accessValidatorMiddleware (req, res, next) {
        const { affectedTables, authorizationLevel } = res.locals;

        if (!pgEntitiesAccessValidator.validate(affectedTables, authorizationLevel)) {
            const error = new SyntaxError('system tables are forbidden');
            error.http_status = 403;

            return next(error);
        }

        return next();
    };
};
