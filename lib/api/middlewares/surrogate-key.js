'use strict';

module.exports = function surrogateKey () {
    return function surrogateKeyMiddleware (req, res, next) {
        const { affectedTables, mayWrite } = res.locals;
        const skipNotUpdatedAtTables = true;

        if (!!affectedTables && affectedTables.getTables(skipNotUpdatedAtTables).length > 0 && !mayWrite) {
            res.header('Surrogate-Key', affectedTables.key(skipNotUpdatedAtTables).join(' '));
        }

        next();
    };
};
