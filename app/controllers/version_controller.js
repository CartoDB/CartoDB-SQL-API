'use strict';

var version = {
    cartodb_sql_api: require(__dirname + '/../../package.json').version
};

function VersionController() {
}

VersionController.prototype.route = function (app) {
    app.get(global.settings.base_url + '/version', this.handleVersion.bind(this));
};

VersionController.prototype.handleVersion = function (req, res) {
    res.send(version);
};

module.exports = VersionController;
