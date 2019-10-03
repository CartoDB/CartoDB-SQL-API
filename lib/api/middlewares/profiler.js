'use strict';

const Profiler = require('../../stats/profiler-proxy');

module.exports = function profiler ({ statsClient }) {
    return function profilerMiddleware (req, res, next) {
        req.profiler = new Profiler({
            profile: global.settings.useProfiler,
            statsd_client: statsClient
        });

        next();
    };
};

module.exports.initializeProfilerMiddleware = function initializeProfiler (label) {
    return function initializeProfilerMiddleware (req, res, next) {
        if (req.profiler) {
            req.profiler.start(`sqlapi.${label}`);
        }

        next();
    };
};

module.exports.finishProfilerMiddleware = function finishProfiler () {
    return function finishProfilerMiddleware (req, res, next) {
        if (req.profiler) {
            req.profiler.end();
            req.profiler.sendStats();

            res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
        }

        next();
    };
};
