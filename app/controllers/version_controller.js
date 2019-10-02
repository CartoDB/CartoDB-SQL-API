'use strict';

const versions = {
    cartodb_sql_api: require('./../../package.json').version
};

module.exports = class VersionController {
    route (apiRouter) {
        apiRouter.get('/version', version());
    }
};

function version () {
    return function versionMiddleware (req, res) {
        res.send(versions);
    };
}
