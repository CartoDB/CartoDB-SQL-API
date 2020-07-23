'use strict';

const Profiler = require('../../stats/profiler-proxy');
const { name: prefix } = require('../../../package.json');

module.exports = function profiler ({ statsClient, logOnEvent = 'finish' }) {
    return function profilerMiddleware (req, res, next) {
        const start = new Date();
        const { logger } = res.locals;

        req.profiler = new Profiler({
            profile: global.settings.useProfiler,
            statsd_client: statsClient
        });

        req.profiler.start(prefix);

        res.on(logOnEvent, () => {
            req.profiler.add({ response: new Date() - start });
            req.profiler.end();
            const stats = req.profiler.toJSON();
            logger.info({ stats, duration: stats.response / 1000, duration_ms: stats.response }, 'Request profiling stats');

            try {
                req.profiler.sendStats();
            } catch (err) {
                logger.warn({ exception: err }, 'Could not send stats to StatsD');
            }
        });

        next();
    };
};
