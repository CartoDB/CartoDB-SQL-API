'use strict';

module.exports = class GenericController {
    route (app) {
        app.options('*', emptyResponse());
    }
};

function emptyResponse () {
    return function emptyResponseMiddleware (req, res) {
        res.end();
    };
}
