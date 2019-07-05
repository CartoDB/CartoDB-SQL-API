'use strict';

module.exports = function cancelOnClientAbort () {
    return function cancelOnClientAbortMiddleware (req, res, next) {
        req.on('aborted', () => {
            if (req.formatter && typeof req.formatter.cancel === 'function') {
                req.formatter.cancel();
            }
        });

        next();
    };
};
