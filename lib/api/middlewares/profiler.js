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
            logger.info({ stats: req.profiler.toJSON() });

            try {
                req.profiler.sendStats();
            } catch (err) {
                logger.warn({ error: err });
            }
        });

        next();
    };
};
