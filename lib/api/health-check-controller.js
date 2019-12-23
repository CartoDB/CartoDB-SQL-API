'use strict';

const HealthCheckBackend = require('../monitoring/health-check');

module.exports = class HealthCheckController {
    constructor () {
        this.healthCheckBackend = new HealthCheckBackend(global.settings.disabled_file);
    }

    route (apiRouter) {
        apiRouter.get('/health', healthCheck({ healthCheckBackend: this.healthCheckBackend }));
    }
};

function healthCheck ({ healthCheckBackend }) {
    return function healthCheckMiddleware (req, res) {
        const healthConfig = global.settings.health || {};

        if (!healthConfig.enabled) {
            return res.status(200).send({ enabled: false, ok: true });
        }

        const startTime = Date.now();

        healthCheckBackend.check((err) => {
            const ok = !err;
            const response = {
                enabled: true,
                ok,
                elapsed: Date.now() - startTime
            };

            if (err) {
                response.err = err.message;
            }

            res.status(ok ? 200 : 503).send(response);
        });
    };
}
