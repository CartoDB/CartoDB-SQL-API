'use strict';

var HealthCheck = require('../monitoring/health_check');

function HealthCheckController() {
    this.healthCheck = new HealthCheck(global.settings.disabled_file);
}

HealthCheckController.prototype.route = function (app) {
    app.get(global.settings.base_url + '/health', this.handleHealthCheck.bind(this));
};

HealthCheckController.prototype.handleHealthCheck = function (req, res) {
    var healthConfig = global.settings.health || {};
    if (!!healthConfig.enabled) {
        var startTime = Date.now();
        this.healthCheck.check(function(err) {
            var ok = !err;
            var response = {
                enabled: true,
                ok: ok,
                elapsed: Date.now() - startTime
            };
            if (err) {
                response.err = err.message;
            }
            res.status(ok ? 200 : 503).send(response);

        });
    } else {
        res.status(200).send({enabled: false, ok: true});
    }
};

module.exports = HealthCheckController;
