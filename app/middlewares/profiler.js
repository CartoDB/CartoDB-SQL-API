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
            req.profiler.done();
            req.profiler.end();
            req.profiler.sendStats();

            res.header('X-SQLAPI-Profiler', req.profiler.toJSONString());
        }

        next();
    };
};
