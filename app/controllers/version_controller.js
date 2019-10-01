'use strict';

const versions = {
    cartodb_sql_api: require('./../../package.json').version
};

module.exports = class VersionController {
    route (app) {
        app.get(`${global.settings.base_url}/version`, version());
    }
};

function version () {
    return function versionMiddleware (req, res) {
        res.send(versions);
    };
}
