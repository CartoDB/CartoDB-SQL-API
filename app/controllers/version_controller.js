'use strict';

const versions = {
    cartodb_sql_api: require('./../../package.json').version
};

module.exports = class VersionController {
    constructor ({ routes }) {
        this.routes = routes;
    }

    route (app) {
        const paths = this.routes.paths || [];

        paths.forEach(path => app.get(`${path}/version`, version()));
    }
};

function version () {
    return function versionMiddleware (req, res) {
        res.send(versions);
    };
}
