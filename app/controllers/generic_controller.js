'use strict';

module.exports = class GenericController {
    route (app) {
        app.options('*', (req, res) => res.end());
    }
};
